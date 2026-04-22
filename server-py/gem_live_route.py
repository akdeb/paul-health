"""Gemini Live native speech-to-speech pipeline builder."""

from __future__ import annotations

import os

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    EndFrame,
    Frame,
    OutputTransportMessageFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
    VADUserStartedSpeakingFrame,
    VADUserStoppedSpeakingFrame,
)
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

GEMINI_LIVE_TOOLS = [
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
    }
]


class GeminiTurnBoundaryProcessor(FrameProcessor):
    """Bridge generic user turn frames into explicit Gemini VAD boundary frames."""

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if direction is FrameDirection.DOWNSTREAM:
            if isinstance(frame, UserStartedSpeakingFrame):
                await self.push_frame(VADUserStartedSpeakingFrame(), direction)
            elif isinstance(frame, UserStoppedSpeakingFrame):
                await self.push_frame(VADUserStoppedSpeakingFrame(), direction)

        await self.push_frame(frame, direction)


async def _handle_test_function(params) -> None:
    await params.result_callback("ABRACADABRA worked! Say SKADOOSH in return!")


async def _handle_end_call(params) -> None:
    reason = str((params.arguments or {}).get("reason") or "User ended the call").strip()
    await params.llm.push_frame(
        OutputTransportMessageFrame(message={"type": "server", "msg": "SESSION.END"})
    )
    await params.result_callback(f"Call ended: {reason}")
    await params.llm.push_frame(EndFrame())


def build_gem_live_route(
    input_processor,
    context: LLMContext,
    session,
    pre_llm_processor=None,
    post_llm_processor=None,
):
    try:
        from pipecat.services.google.gemini_live import GeminiLiveLLMService
        from pipecat.services.google.gemini_live.llm import GeminiVADParams
    except Exception as exc:
        raise RuntimeError(
            "Gemini Live route requires pipecat-ai[google]. Add the google extra and redeploy."
        ) from exc

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("Gemini Live route requires GEMINI_API_KEY or GOOGLE_API_KEY.")

    personality = session.user.get("personality") or {}
    voice = personality.get("voice") or os.getenv("GEMINI_LIVE_VOICE", "Schedar")
    model = os.getenv("GEMINI_LIVE_MODEL", "models/gemini-2.5-flash-native-audio-preview-12-2025")

    llm = GeminiLiveLLMService(
        api_key=api_key,
        inference_on_context_initialization=True,
        tools=GEMINI_LIVE_TOOLS,
        settings=GeminiLiveLLMService.Settings(
            model=model,
            voice=voice,
            system_instruction=session.system_prompt,
            vad=GeminiVADParams(disabled=True),
        ),
    )
    llm.register_function("test_function", _handle_test_function)
    llm.register_function("end_call", _handle_end_call, cancel_on_interruption=False)

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(
                    confidence=float(os.getenv("GEM_LIVE_VAD_CONFIDENCE", "0.6")),
                    start_secs=float(os.getenv("GEM_LIVE_VAD_START_SECS", "0.1")),
                    stop_secs=float(os.getenv("GEM_LIVE_VAD_STOP_SECS", "0.5")),
                    min_volume=float(os.getenv("GEM_LIVE_VAD_MIN_VOLUME", "0.45")),
                )
            )
        ),
    )
    turn_boundary_processor = GeminiTurnBoundaryProcessor()

    processors = [
        input_processor,
        user_aggregator,
        turn_boundary_processor,
    ]
    if pre_llm_processor is not None:
        processors.append(pre_llm_processor)
    processors.append(llm)
    if post_llm_processor is not None:
        processors.append(post_llm_processor)

    return processors, assistant_aggregator
