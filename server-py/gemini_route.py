"""Direct Gemini Live websocket route without Pipecat."""

from __future__ import annotations

import asyncio
import json
import os
from contextlib import suppress
from typing import Any, Literal

from fastapi import WebSocket
from google import genai
from google.genai import types
from loguru import logger

from audio_codecs import OpusEncoder
from session import SessionState, add_conversation, get_device_info

GEMINI_DIRECT_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "test_function",
                "description": (
                    "A simple test function that always returns hello world. "
                    "Use this when the user says ABRACADABRA."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {},
                },
            },
            {
                "name": "end_call",
                "description": (
                    "Call this if the user says bye or needs to leave or suggests they want "
                    'to end the session. Examples include "I gotta go", "I have to work", '
                    '"I have to sleep", or "I have to do something else".'
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": {
                            "type": "string",
                            "description": "Short reason for ending the call.",
                        }
                    },
                    "required": ["reason"],
                },
            },
        ]
    },
    {"google_search": {}},
]


class GeminiDirectRunner:
    def __init__(
        self,
        websocket: WebSocket,
        transport_kind: Literal["browser", "esp32"],
        session: SessionState,
    ):
        self._websocket = websocket
        self._transport_kind = transport_kind
        self._session = session
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini direct route requires GEMINI_API_KEY or GOOGLE_API_KEY.")
        self._client = genai.Client(api_key=api_key)
        self._closed = False
        self._session_handle = None
        self._opus_encoder = (
            OpusEncoder(sample_rate=24000, channels=1, bit_rate=24000)
            if transport_kind == "esp32"
            else None
        )
        self._vad_end_silence_ms = 100
        self._vad_prefix_padding_ms = 100

    def _voice_name(self) -> str:
        personality = self._session.user.get("personality") or {}
        return personality.get("voice") or os.environ.get("GEMINI_LIVE_VOICE", "Schedar")

    def _model_name(self) -> str:
        return os.environ.get(
            "GEMINI_LIVE_MODEL",
            "models/gemini-2.5-flash-native-audio-preview-12-2025",
        )

    def _audio_mime_type(self) -> str:
        # The ESP32/browser input stream is 16kHz PCM on this server path.
        return "audio/pcm;rate=16000"

    def _build_config(self) -> types.LiveConnectConfig:
        return types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=self._session.system_prompt,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=self._voice_name()
                    )
                )
            ),
            realtime_input_config=types.RealtimeInputConfig(
                automatic_activity_detection=types.AutomaticActivityDetection(
                    disabled=False,
                    end_of_speech_sensitivity=types.EndSensitivity.END_SENSITIVITY_LOW,
                    prefix_padding_ms=self._vad_prefix_padding_ms,
                    silence_duration_ms=self._vad_end_silence_ms,
                )
            ),
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            tools=GEMINI_DIRECT_TOOLS,
        )

    async def _send_transport_message(self, message: dict[str, Any]) -> None:
        await self._websocket.send_text(json.dumps(message))

    async def _send_response_created(self) -> None:
        if self._opus_encoder is not None:
            self._opus_encoder.reset()

        latest_device = get_device_info(self._session.supabase, self._session.user["user_id"])
        message: dict[str, Any] = {"type": "server", "msg": "RESPONSE.CREATED"}
        if latest_device and latest_device.get("volume") is not None:
            message["volume_control"] = latest_device["volume"]
        await self._send_transport_message(message)

    async def _send_response_complete(self) -> None:
        if self._transport_kind == "esp32" and self._opus_encoder is not None:
            for packet in self._opus_encoder.flush(pad_final_frame=True):
                await self._websocket.send_bytes(packet)
        await self._send_transport_message({"type": "server", "msg": "RESPONSE.COMPLETE"})

    async def _send_response_error(self) -> None:
        if self._opus_encoder is not None:
            self._opus_encoder.reset()
        await self._send_transport_message({"type": "server", "msg": "RESPONSE.ERROR"})

    async def _send_audio_bytes(self, audio_bytes: bytes) -> None:
        if not audio_bytes:
            return

        if self._transport_kind == "esp32":
            assert self._opus_encoder is not None
            for packet in self._opus_encoder.encode(audio_bytes):
                await self._websocket.send_bytes(packet)
        else:
            await self._websocket.send_bytes(audio_bytes)

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

    async def _handle_tool_call(self, tool_call: types.LiveServerToolCall) -> None:
        if self._session_handle is None or not tool_call.function_calls:
            return

        responses: list[types.FunctionResponse] = []
        for function_call in tool_call.function_calls:
            if function_call.name == "test_function":
                responses.append(
                    types.FunctionResponse(
                        id=function_call.id,
                        name="test_function",
                        response={"output": "ABRACADABRA worked! Say SKADOOSH in return!"},
                    )
                )
            elif function_call.name == "end_call":
                reason = str((function_call.args or {}).get("reason") or "User ended the call").strip()
                await self._send_transport_message({"type": "server", "msg": "SESSION.END"})
                responses.append(
                    types.FunctionResponse(
                        id=function_call.id,
                        name="end_call",
                        response={"output": f"Call ended: {reason}"},
                    )
                )

        if responses:
            await self._session_handle.send_tool_response(function_responses=responses)

    async def _run_receive_loop(self) -> None:
        assert self._session_handle is not None
        while not self._closed:
            assistant_transcript_parts: list[str] = []
            user_transcript_parts: list[str] = []
            sent_response_created = False

            async for message in self._session_handle.receive():
                if self._closed:
                    return

                if message.tool_call:
                    await self._handle_tool_call(message.tool_call)
                    continue

                if message.server_content:
                    server_content = message.server_content

                    if server_content.input_transcription and server_content.input_transcription.text:
                        user_transcript_parts.append(server_content.input_transcription.text)

                    if server_content.output_transcription and server_content.output_transcription.text:
                        assistant_transcript_parts.append(server_content.output_transcription.text)

                    if message.data:
                        if not sent_response_created:
                            sent_response_created = True
                            await self._send_response_created()
                        await self._send_audio_bytes(message.data)

                    if server_content.interrupted:
                        sent_response_created = False
                        if self._opus_encoder is not None:
                            self._opus_encoder.reset()

                    if server_content.turn_complete:
                        if not sent_response_created and assistant_transcript_parts:
                            await self._send_response_created()
                        await self._send_response_complete()
                        sent_response_created = False

                        if user_transcript_parts:
                            await self._persist_user_transcript("".join(user_transcript_parts))
                            user_transcript_parts.clear()
                        if assistant_transcript_parts:
                            await self._persist_assistant_transcript("".join(assistant_transcript_parts))
                            assistant_transcript_parts.clear()

    async def _run_client_loop(self) -> None:
        assert self._session_handle is not None
        while not self._closed:
            message = await self._websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                break

            if message.get("bytes") is not None:
                await self._session_handle.send_realtime_input(
                    audio=types.Blob(
                        data=message["bytes"],
                        mime_type=self._audio_mime_type(),
                    )
                )
            elif message.get("text") is not None:
                try:
                    payload = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue
                if payload.get("type") == "instruction" and payload.get("msg") == "INTERRUPT":
                    # No explicit truncate path in this first direct Gemini route.
                    continue

    async def run(self) -> None:
        logger.info(
            "Starting direct Gemini session for {} using model={}",
            self._transport_kind,
            self._model_name(),
        )

        async with self._client.aio.live.connect(
            model=self._model_name(),
            config=self._build_config(),
        ) as session_handle:
            self._session_handle = session_handle

            if self._session.first_message.strip():
                await session_handle.send_client_content(
                    turns=types.Content(
                        role="user",
                        parts=[types.Part(text=self._session.first_message)],
                    ),
                    turn_complete=True,
                )

            client_task = asyncio.create_task(self._run_client_loop())
            receive_task = asyncio.create_task(self._run_receive_loop())

            done, pending = await asyncio.wait(
                {client_task, receive_task},
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

    async def close(self) -> None:
        self._closed = True
        if self._opus_encoder is not None:
            self._opus_encoder.close()
        await self._session.cleanup()


async def run_gemini_session(
    websocket: WebSocket,
    transport_kind: Literal["browser", "esp32"],
    session: SessionState,
) -> None:
    runner = GeminiDirectRunner(websocket, transport_kind, session)
    try:
        await runner.run()
    except Exception:
        logger.exception("Direct Gemini route failed")
        with suppress(Exception):
            await websocket.send_text('{"type":"server","msg":"RESPONSE.ERROR"}')
        raise
    finally:
        await runner.close()
