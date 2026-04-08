#
# Copyright (c) 2024-2026, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""Shared Pipecat bot logic for the local multi-transport server."""

import asyncio
import os
from array import array
from typing import Literal

from dotenv import load_dotenv
from loguru import logger

from classic_route import build_classic_route
from gem_live_route import build_gem_live_route
from session import SessionState, add_conversation, get_device_info

logger.info("Loading Silero VAD model...")

logger.info("Silero VAD model loaded")

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    EmulateUserStoppedSpeakingFrame,
    EndFrame,
    ErrorFrame,
    Frame,
    InputAudioRawFrame,
    InputTransportMessageFrame,
    InterruptionFrame,
    LLMContextFrame,
    LLMFullResponseEndFrame,
    LLMRunFrame,
    OutputAudioRawFrame,
    OutputTransportMessageFrame,
    StartFrame,
    STTMuteFrame,
    TranscriptionFrame,
    TTSStoppedFrame,
    TTSTextFrame,
    UserStoppedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.transports.base_transport import BaseTransport

logger.info("All components loaded successfully")

load_dotenv(override=True)
CURRENT_VOICE_ROUTE = os.getenv("CURRENT_VOICE_ROUTE", "classic").strip().lower()


class RealtimeInputControlProcessor(FrameProcessor):
    """Bridge incoming websocket control messages into Pipecat frames."""

    def __init__(self, voice_route: str):
        super().__init__()
        self._voice_route = voice_route

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, InputTransportMessageFrame):
            message = frame.message if isinstance(frame.message, dict) else {}
            msg_type = message.get("type")
            msg = message.get("msg")

            if msg_type == "instruction" and msg == "end_of_speech":
                if self._voice_route == "gem_live":
                    await self.push_frame(VADUserStoppedSpeakingFrame(), FrameDirection.DOWNSTREAM)
                else:
                    await self.push_frame(
                        EmulateUserStoppedSpeakingFrame(), FrameDirection.DOWNSTREAM
                    )
                    await self.push_frame(STTMuteFrame(mute=True), FrameDirection.DOWNSTREAM)
                return

            if msg_type == "instruction" and msg == "INTERRUPT":
                await self.push_frame(InterruptionFrame(), FrameDirection.DOWNSTREAM)
                if self._voice_route != "gem_live":
                    await self.push_frame(STTMuteFrame(mute=False), FrameDirection.DOWNSTREAM)
                return

        await self.push_frame(frame, direction)


class RealtimeOutputControlProcessor(FrameProcessor):
    """Translate pipeline state changes into the old websocket control protocol."""

    def __init__(self, session: SessionState):
        super().__init__()
        self._session = session
        self._response_started = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if direction is FrameDirection.DOWNSTREAM:
            if isinstance(frame, (UserStoppedSpeakingFrame, VADUserStoppedSpeakingFrame)):
                await self.push_frame(
                    OutputTransportMessageFrame(message={"type": "server", "msg": "AUDIO.COMMITTED"}),
                    direction,
                )
            elif isinstance(frame, OutputAudioRawFrame) and not self._response_started:
                self._response_started = True
                logger.debug("Sending RESPONSE.CREATED before first audio packet")
                await self.push_frame(STTMuteFrame(mute=True), direction)
                latest_device = get_device_info(
                    self._session.supabase,
                    self._session.user["user_id"],
                )
                response_created_message = {
                    "type": "server",
                    "msg": "RESPONSE.CREATED",
                }
                if latest_device and latest_device.get("volume") is not None:
                    response_created_message["volume_control"] = latest_device["volume"]
                await self.push_frame(
                    OutputTransportMessageFrame(message=response_created_message),
                    direction,
                )
            elif isinstance(frame, (TTSStoppedFrame, BotStoppedSpeakingFrame)):
                self._response_started = False
                logger.debug("Sending RESPONSE.COMPLETE after TTS stop")
                await self.push_frame(STTMuteFrame(mute=False), direction)
                await self.push_frame(frame, direction)
                await self.push_frame(
                    OutputTransportMessageFrame(message={"type": "server", "msg": "RESPONSE.COMPLETE"}),
                    direction,
                )
                return
            elif isinstance(frame, ErrorFrame):
                self._response_started = False
                await self.push_frame(STTMuteFrame(mute=False), direction)
                await self.push_frame(
                    OutputTransportMessageFrame(message={"type": "server", "msg": "RESPONSE.ERROR"}),
                    direction,
                )

        await self.push_frame(frame, direction)


class ConversationPersistenceProcessor(FrameProcessor):
    """Persist finalized user and assistant transcript turns to Supabase."""

    def __init__(
        self,
        session: SessionState,
        *,
        persist_user: bool = False,
        persist_assistant: bool = False,
    ):
        super().__init__()
        self._session = session
        self._persist_user = persist_user
        self._persist_assistant = persist_assistant
        self._assistant_chunks: list[str] = []

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if self._persist_user and isinstance(frame, TranscriptionFrame) and frame.text.strip():
            if frame.finalized or direction is FrameDirection.UPSTREAM:
                try:
                    add_conversation(
                        self._session.supabase,
                        speaker="user",
                        content=frame.text,
                        action_id=self._session.action_id,
                        user_id=self._session.user["user_id"],
                    )
                except Exception as exc:
                    logger.warning("Failed to persist user transcript: {}", exc)
        elif self._persist_assistant and isinstance(frame, TTSTextFrame) and frame.text.strip():
            self._assistant_chunks.append(frame.text)
        elif self._persist_assistant and isinstance(frame, (TTSStoppedFrame, LLMFullResponseEndFrame)):
            if self._assistant_chunks:
                assistant_text = "".join(self._assistant_chunks).strip()
                self._assistant_chunks.clear()
                if assistant_text:
                    try:
                        add_conversation(
                            self._session.supabase,
                            speaker="assistant",
                            content=assistant_text,
                            action_id=self._session.action_id,
                            user_id=self._session.user["user_id"],
                        )
                    except Exception as exc:
                        logger.warning("Failed to persist assistant transcript: {}", exc)

        await self.push_frame(frame, direction)


class ListeningIdleTimeoutProcessor(FrameProcessor):
    """End the session if the user does not say anything after listening starts."""

    def __init__(
        self,
        timeout_seconds: float = 10.0,
        *,
        arm_on_start: bool = False,
        speech_peak_threshold: int = 1200,
    ):
        super().__init__()
        self._timeout_seconds = timeout_seconds
        self._arm_on_start = arm_on_start
        self._speech_peak_threshold = speech_peak_threshold
        self._idle_task: asyncio.Task | None = None

    def _looks_like_user_speech(self, frame: InputAudioRawFrame) -> bool:
        if not frame.audio:
            return False
        try:
            samples = array("h")
            samples.frombytes(frame.audio)
            if not samples:
                return False
            peak = max(abs(sample) for sample in samples)
            return peak >= self._speech_peak_threshold
        except Exception:
            return False

    async def _cancel_idle_task(self) -> None:
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()
            try:
                await self._idle_task
            except asyncio.CancelledError:
                pass
        self._idle_task = None

    def _arm_idle_timeout(self) -> None:
        if self._idle_task and not self._idle_task.done():
            self._idle_task.cancel()

        async def _timeout() -> None:
            try:
                await asyncio.sleep(self._timeout_seconds)
                await self.push_frame(
                    OutputTransportMessageFrame(message={"type": "server", "msg": "SESSION.END"}),
                    FrameDirection.DOWNSTREAM,
                )
                await self.push_frame(EndFrame(), FrameDirection.DOWNSTREAM)
            except asyncio.CancelledError:
                raise

        self._idle_task = self.create_task(_timeout())

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, StartFrame):
            if self._arm_on_start:
                self._arm_idle_timeout()
            else:
                await self._cancel_idle_task()
        elif isinstance(frame, (BotStartedSpeakingFrame, OutputAudioRawFrame)):
            await self._cancel_idle_task()
        elif isinstance(frame, (TTSStoppedFrame, BotStoppedSpeakingFrame)):
            self._arm_idle_timeout()
        elif isinstance(frame, InputAudioRawFrame) and self._looks_like_user_speech(frame):
            await self._cancel_idle_task()
        elif isinstance(frame, TranscriptionFrame) and frame.text.strip():
            await self._cancel_idle_task()
        elif isinstance(frame, (UserStoppedSpeakingFrame, VADUserStoppedSpeakingFrame)):
            await self._cancel_idle_task()
        elif isinstance(frame, ErrorFrame):
            await self._cancel_idle_task()

        await self.push_frame(frame, direction)


async def run_bot_session(
    transport: BaseTransport,
    transport_kind: Literal["browser", "esp32"],
    session: SessionState,
    handle_sigint: bool = False,
):
    voice_route = CURRENT_VOICE_ROUTE
    logger.info(f"Starting bot session for {transport_kind} via route={voice_route}")

    context = LLMContext()
    input_processor = RealtimeInputControlProcessor(voice_route)
    user_persistence = ConversationPersistenceProcessor(session, persist_user=True)
    assistant_persistence = ConversationPersistenceProcessor(session, persist_assistant=True)
    if voice_route == "gem_live":
        route_processors, assistant_aggregator = build_gem_live_route(
            input_processor,
            context,
            session,
            pre_llm_processor=user_persistence,
            post_llm_processor=assistant_persistence,
        )
    else:
        route_processors, assistant_aggregator = build_classic_route(input_processor, context)

    idle_timeout = ListeningIdleTimeoutProcessor(
        timeout_seconds=10.0,
        arm_on_start=not session.first_message.strip(),
    )
    processors = [transport.input(), *route_processors]
    if voice_route != "gem_live":
        processors.append(user_persistence)
        processors.append(assistant_persistence)

    if transport_kind in {"esp32", "browser"}:
        processors.append(RealtimeOutputControlProcessor(session))
        processors.append(idle_timeout)
    processors.append(transport.output())
    processors.append(assistant_aggregator)

    pipeline = Pipeline(processors)

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
        ),
    )

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"{transport_kind} client connected")
        if voice_route in {"gem_live", "grok"}:
            if session.first_message.strip():
                context.add_message(
                    {
                        "role": "user",
                        "content": session.first_message,
                    }
                )
                await task.queue_frames([LLMContextFrame(context=context)])
        else:
            context.add_message(
                {
                    "role": "developer",
                    "content": session.first_message or "Say hello and briefly introduce yourself.",
                }
            )
            await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"{transport_kind} client disconnected")
        await task.cancel()
        await session.cleanup()

    runner = PipelineRunner(handle_sigint=handle_sigint)
    try:
        await runner.run(task)
    finally:
        await session.cleanup()
