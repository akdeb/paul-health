"""Gemini Live native speech-to-speech pipeline builder."""

from __future__ import annotations

import os

from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import EndFrame, OutputTransportMessageFrame
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.turns.user_stop import TurnAnalyzerUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies

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


def _build_user_aggregator_params() -> LLMUserAggregatorParams:
    smart_turn_stop_secs = float(os.getenv("PIPECAT_SMART_TURN_STOP_SECS", "3.0"))
    smart_turn_pre_speech_ms = float(os.getenv("PIPECAT_SMART_TURN_PRE_SPEECH_MS", "500"))
    smart_turn_max_duration_secs = float(
        os.getenv("PIPECAT_SMART_TURN_MAX_DURATION_SECS", "8.0")
    )
    vad_stop_secs = float(os.getenv("PIPECAT_SMART_TURN_VAD_STOP_SECS", "0.2"))
    vad_confidence = float(os.getenv("PIPECAT_SMART_TURN_VAD_CONFIDENCE", "0.7"))
    vad_start_secs = float(os.getenv("PIPECAT_SMART_TURN_VAD_START_SECS", "0.2"))
    vad_min_volume = float(os.getenv("PIPECAT_SMART_TURN_VAD_MIN_VOLUME", "0.6"))

    return LLMUserAggregatorParams(
        user_turn_strategies=UserTurnStrategies(
            stop=[
                TurnAnalyzerUserTurnStopStrategy(
                    turn_analyzer=LocalSmartTurnAnalyzerV3(
                        params=SmartTurnParams(
                            stop_secs=smart_turn_stop_secs,
                            pre_speech_ms=smart_turn_pre_speech_ms,
                            max_duration_secs=smart_turn_max_duration_secs,
                        )
                    )
                )
            ]
        ),
        vad_analyzer=SileroVADAnalyzer(
            params=VADParams(
                confidence=vad_confidence,
                start_secs=vad_start_secs,
                stop_secs=vad_stop_secs,
                min_volume=vad_min_volume,
            )
        ),
    )


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
        ),
    )
    llm.register_function("test_function", _handle_test_function)
    llm.register_function("end_call", _handle_end_call, cancel_on_interruption=False)

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=_build_user_aggregator_params(),
    )
    processors = [
        input_processor,
        user_aggregator,
    ]
    if pre_llm_processor is not None:
        processors.append(pre_llm_processor)
    processors.append(llm)
    if post_llm_processor is not None:
        processors.append(post_llm_processor)

    return processors, assistant_aggregator
