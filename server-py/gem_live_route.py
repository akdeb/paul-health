"""Gemini Live native speech-to-speech pipeline builder."""

from __future__ import annotations

import os

from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair


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
        settings=GeminiLiveLLMService.Settings(
            model=model,
            voice=voice,
            system_instruction=session.system_prompt,
        ),
    )

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(context)
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
