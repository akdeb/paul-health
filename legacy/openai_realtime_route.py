"""Direct OpenAI Realtime websocket route without Pipecat."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
from contextlib import suppress
from typing import Any, Literal

import numpy as np
from fastapi import WebSocket
from loguru import logger
from openai import OpenAI
from websockets.exceptions import ConnectionClosed

from audio_codecs import OpusEncoder
from onboarding import MARK_ONBOARDING_ITEM_TOOL, mark_onboarding_item_complete
from session import SessionState, add_conversation, get_device_info

OPENAI_REALTIME_ALLOWED_VOICES = {
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "marin",
    "sage",
    "shimmer",
    "verse",
}


def _upsample_pcm16_mono(audio_bytes: bytes, *, src_rate: int = 16000, dst_rate: int = 24000) -> bytes:
    if src_rate == dst_rate or not audio_bytes:
        return audio_bytes

    samples = np.frombuffer(audio_bytes, dtype=np.int16)
    if samples.size == 0:
        return audio_bytes

    src_positions = np.arange(samples.size, dtype=np.float32)
    dst_length = int(round(samples.size * dst_rate / src_rate))
    dst_positions = np.linspace(0, samples.size - 1, dst_length, dtype=np.float32)
    resampled = np.interp(dst_positions, src_positions, samples.astype(np.float32))
    return np.clip(resampled, -32768, 32767).astype(np.int16).tobytes()


class OpenAIRealtimeRunner:
    def __init__(
        self,
        websocket: WebSocket,
        transport_kind: Literal["browser", "esp32"],
        session: SessionState,
    ):
        self._websocket = websocket
        self._transport_kind = transport_kind
        self._session = session
        self._client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self._connection = None
        self._send_lock = asyncio.Lock()
        self._closed = False
        self._last_assistant_item_id: str | None = None
        self._opus_encoder = (
            OpusEncoder(sample_rate=24000, channels=1, bit_rate=24000)
            if transport_kind == "esp32"
            else None
        )

    def _openai_voice(self) -> str:
        configured = (
            (self._session.user.get("personality") or {}).get("voice")
            or os.getenv("OPENAI_REALTIME_VOICE")
            or "ash"
        )
        return configured if configured in OPENAI_REALTIME_ALLOWED_VOICES else "ash"

    def _safety_identifier(self) -> str:
        raw = self._session.user.get("user_id") or self._session.user.get("email") or "anonymous"
        return hashlib.sha256(str(raw).encode("utf-8")).hexdigest()

    def _turn_detection(self) -> dict[str, Any] | None:
        return {
            "type": "server_vad",
            "threshold": float(os.getenv("OPENAI_REALTIME_VAD_THRESHOLD", "0.4")),
            "prefix_padding_ms": int(os.getenv("OPENAI_REALTIME_VAD_PREFIX_PADDING_MS", "400")),
            "silence_duration_ms": int(os.getenv("OPENAI_REALTIME_VAD_SILENCE_MS", "1000")),
            "create_response": True,
            "interrupt_response": True,
        }

    def _tool_definitions(self) -> list[dict[str, Any]]:
        mark_onboarding_tool = {
            "type": "function",
            **MARK_ONBOARDING_ITEM_TOOL,
            "parameters": {
                **MARK_ONBOARDING_ITEM_TOOL["parameters"],
                "additionalProperties": False,
            },
        }
        return [
            {
                "type": "function",
                "name": "end_session",
                "description": (
                    'Call this if the user says bye or needs to leave or suggests they want '
                    'to end the session. Examples include "I gotta go", "I have to work", '
                    '"I have to sleep", or "I have to do something else".'
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Short reason for ending the session.",
                        }
                    },
                    "required": ["reason"],
                    "additionalProperties": False,
                },
            },
            mark_onboarding_tool,
        ]

    async def _connection_send(self, fn, /, *args, **kwargs):
        async with self._send_lock:
            return await asyncio.to_thread(fn, *args, **kwargs)

    async def _send_transport_message(self, message: dict[str, Any]) -> None:
        await self._websocket.send_text(json.dumps(message))

    async def _send_client_audio(self, pcm24k_bytes: bytes) -> None:
        if not pcm24k_bytes:
            return

        if self._transport_kind == "esp32":
            assert self._opus_encoder is not None
            for packet in self._opus_encoder.encode(pcm24k_bytes):
                await self._websocket.send_bytes(packet)
        else:
            await self._websocket.send_bytes(pcm24k_bytes)

    async def _flush_output_audio(self) -> None:
        if self._transport_kind != "esp32" or self._opus_encoder is None:
            return

        for packet in self._opus_encoder.flush(pad_final_frame=True):
            await self._websocket.send_bytes(packet)

    async def _send_response_created(self) -> None:
        if self._opus_encoder is not None:
            self._opus_encoder.reset()

        latest_device = get_device_info(self._session.supabase, self._session.user["user_id"])
        message: dict[str, Any] = {"type": "server", "msg": "RESPONSE.CREATED"}
        if latest_device and latest_device.get("volume") is not None:
            message["volume_control"] = latest_device["volume"]
        logger.debug("Sending RESPONSE.CREATED from OpenAI route")
        await self._send_transport_message(message)

    async def _send_response_complete(self) -> None:
        await self._flush_output_audio()
        logger.debug("Sending RESPONSE.COMPLETE from OpenAI route")
        await self._send_transport_message({"type": "server", "msg": "RESPONSE.COMPLETE"})

    async def _send_response_error(self) -> None:
        logger.debug("Sending RESPONSE.ERROR from OpenAI route")
        await self._send_transport_message({"type": "server", "msg": "RESPONSE.ERROR"})

    async def _configure_session(self) -> None:
        assert self._connection is not None
        transcription_model = os.getenv(
            "OPENAI_REALTIME_TRANSCRIPTION_MODEL",
            "gpt-4o-mini-transcribe",
        )
        await self._connection_send(
            self._connection.session.update,
            session={
                "type": "realtime",
                "instructions": self._session.system_prompt,
                "output_modalities": ["audio"],
                "audio": {
                    "input": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "transcription": {"model": transcription_model},
                        "turn_detection": self._turn_detection(),
                    },
                    "output": {
                        "format": {"type": "audio/pcm", "rate": 24000},
                        "voice": self._openai_voice(),
                    },
                },
                "tools": self._tool_definitions(),
                "tool_choice": "auto",
            },
        )

    async def _seed_first_turn(self) -> None:
        if not self._session.first_message.strip():
            return

        assert self._connection is not None
        await self._connection_send(
            self._connection.conversation.item.create,
            item={
                "type": "message",
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": self._session.first_message,
                    }
                ],
            },
        )
        await self._connection_send(self._connection.response.create)

    async def _append_audio(self, audio_bytes: bytes) -> None:
        if not audio_bytes or self._connection is None:
            return

        audio_24k = _upsample_pcm16_mono(audio_bytes)
        encoded = base64.b64encode(audio_24k).decode("utf-8")
        await self._connection_send(self._connection.input_audio_buffer.append, audio=encoded)

    async def _handle_interrupt(self, audio_end_ms: int | None) -> None:
        if self._connection is None:
            return

        with suppress(Exception):
            await self._connection_send(self._connection.response.cancel)
        if self._last_assistant_item_id and audio_end_ms is not None:
            with suppress(Exception):
                await self._connection_send(
                    self._connection.conversation.item.truncate,
                    item_id=self._last_assistant_item_id,
                    content_index=0,
                    audio_end_ms=int(audio_end_ms),
                )
        with suppress(Exception):
            await self._connection_send(self._connection.input_audio_buffer.clear)

    async def _handle_client_text(self, raw_text: str) -> None:
        try:
            message = json.loads(raw_text)
        except json.JSONDecodeError:
            logger.warning("Ignoring non-JSON control message from client")
            return

        if message.get("type") != "instruction" or self._connection is None:
            return

        command = message.get("msg")
        if command == "end_of_speech" and self._transport_kind == "esp32":
            await self._connection_send(self._connection.input_audio_buffer.commit)
            await self._connection_send(self._connection.response.create)
            await self._connection_send(self._connection.input_audio_buffer.clear)
        elif command == "INTERRUPT":
            await self._handle_interrupt(message.get("audio_end_ms"))

    async def _persist_user_transcript(self, transcript: str) -> None:
        cleaned = transcript.strip()
        if not cleaned:
            return
        add_conversation(
            self._session.supabase,
            speaker="user",
            content=cleaned,
            action_id=self._session.action_id,
            user_id=self._session.user["user_id"],
        )

    async def _persist_assistant_transcript(self, transcript: str) -> None:
        cleaned = transcript.strip()
        if not cleaned:
            return
        add_conversation(
            self._session.supabase,
            speaker="assistant",
            content=cleaned,
            action_id=self._session.action_id,
            user_id=self._session.user["user_id"],
        )

    async def _handle_tool_call(self, event: Any) -> None:
        if self._connection is None:
            return

        if event.name not in {"end_session", "mark_onboarding_item_complete"}:
            return

        arguments: dict[str, Any] = {}
        if event.arguments:
            try:
                arguments = json.loads(event.arguments)
            except json.JSONDecodeError:
                pass

        if event.name == "mark_onboarding_item_complete":
            key = str(arguments.get("key") or "").strip()
            try:
                output = mark_onboarding_item_complete(
                    self._session.supabase,
                    self._session.user,
                    key,
                )
            except Exception as exc:
                output = {"success": False, "error": str(exc), "key": key}

            await self._connection_send(
                self._connection.conversation.item.create,
                item={
                    "type": "function_call_output",
                    "call_id": event.call_id,
                    "output": json.dumps(output),
                },
            )
            await self._connection_send(self._connection.response.create)
            return

        reason = str(arguments.get("reason") or "User ended the session")

        await self._connection_send(
            self._connection.conversation.item.create,
            item={
                "type": "function_call_output",
                "call_id": event.call_id,
                "output": json.dumps({"success": True, "reason": reason}),
            },
        )
        await self._send_transport_message({"type": "server", "msg": "SESSION.END"})
        await self._connection_send(self._connection.response.create)

    async def _handle_openai_event(self, event: Any) -> None:
        event_type = getattr(event, "type", "")

        if event_type == "session.created":
            logger.info("OpenAI Realtime session created")
        elif event_type == "session.updated":
            logger.info("OpenAI Realtime session updated")
        elif event_type == "input_audio_buffer.committed":
            await self._send_transport_message({"type": "server", "msg": "AUDIO.COMMITTED"})
        elif event_type == "response.created":
            await self._send_response_created()
        elif event_type == "response.output_item.added":
            item = getattr(event, "item", None)
            if item and getattr(item, "type", None) == "message" and getattr(item, "role", None) == "assistant":
                self._last_assistant_item_id = item.id
        elif event_type == "response.output_audio.delta":
            await self._send_client_audio(base64.b64decode(event.delta))
        elif event_type == "response.output_audio_transcript.done":
            await self._persist_assistant_transcript(event.transcript)
        elif event_type == "conversation.item.input_audio_transcription.completed":
            await self._persist_user_transcript(event.transcript)
        elif event_type == "response.function_call_arguments.done":
            await self._handle_tool_call(event)
        elif event_type == "response.done":
            status = getattr(getattr(event, "response", None), "status", None)
            if status == "completed":
                await self._send_response_complete()
            elif status == "cancelled":
                if self._opus_encoder is not None:
                    self._opus_encoder.reset()
            else:
                await self._send_response_error()
        elif event_type == "error":
            logger.warning("OpenAI Realtime error event: {}", event)
            await self._send_response_error()

    async def _client_loop(self) -> None:
        while not self._closed:
            message = await self._websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                break
            if message.get("bytes") is not None:
                await self._append_audio(message["bytes"])
            elif message.get("text") is not None:
                await self._handle_client_text(message["text"])

    async def _openai_loop(self) -> None:
        while not self._closed and self._connection is not None:
            try:
                event = await asyncio.to_thread(self._connection.recv)
            except ConnectionClosed:
                break
            await self._handle_openai_event(event)

    async def run(self) -> None:
        model = os.getenv("OPENAI_REALTIME_MODEL", "gpt-realtime-2")
        logger.info(
            "Starting OpenAI Realtime session for {} using model={}",
            self._transport_kind,
            model,
        )

        self._connection = await asyncio.to_thread(
            self._client.realtime.connect(
                model=model,
                extra_headers={"OpenAI-Safety-Identifier": self._safety_identifier()},
            ).enter
        )

        try:
            await self._configure_session()
            await self._seed_first_turn()

            client_task = asyncio.create_task(self._client_loop())
            openai_task = asyncio.create_task(self._openai_loop())

            done, pending = await asyncio.wait(
                {client_task, openai_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task
            for task in done:
                exc = task.exception()
                if exc:
                    raise exc
        finally:
            self._closed = True
            if self._connection is not None:
                with suppress(Exception):
                    await asyncio.to_thread(self._connection.close)
            if self._opus_encoder is not None:
                self._opus_encoder.close()
            await self._session.cleanup()


async def run_openai_realtime_session(
    websocket: WebSocket,
    transport_kind: Literal["browser", "esp32"],
    session: SessionState,
) -> None:
    runner = OpenAIRealtimeRunner(websocket, transport_kind, session)
    await runner.run()
