"""Conversation prompt builders for Paul."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from app_types import ActionTransportType, IConversation, IJob, IUser


def compose_chat_history(conversations: list[IConversation]) -> str:
    return "\n".join(
        f"{item.get('role', 'unknown')} [{datetime.fromisoformat(str(item['created_at']).replace('Z', '+00:00')).isoformat()}]: {item.get('content', '')}"
        for item in conversations
        if item.get("created_at")
    )


def _compose_recent_chat_history(
    conversations: list[IConversation],
    *,
    max_items: int = 6,
) -> str:
    recent_items = conversations[-max_items:]
    return compose_chat_history(recent_items)


def _parse_conversation_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _parse_user_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _get_last_conversation(conversations: list[IConversation]) -> IConversation | None:
    if not conversations:
        return None
    sorted_items = sorted(
        conversations,
        key=lambda item: _parse_conversation_timestamp(item.get("created_at")) or datetime.min,
    )
    return sorted_items[-1] if sorted_items else None


def _hours_since_last_conversation(conversations: list[IConversation]) -> float | None:
    last_item = _get_last_conversation(conversations)
    if not last_item:
        return None
    last_timestamp = _parse_conversation_timestamp(last_item.get("created_at"))
    if not last_timestamp:
        return None
    return max(0.0, (datetime.now(last_timestamp.tzinfo) - last_timestamp).total_seconds() / 3600.0)


def _build_engine_state(
    user: IUser,
    *,
    prior_action_count: int,
    chat_history: list[IConversation],
) -> dict[str, Any]:
    if prior_action_count == 0 and not chat_history:
        return {"active": True, "stage": "first_contact"}

    onboarding_days = int(os.getenv("PAUL_ONBOARDING_DAYS", "3"))
    onboarding_session_cap = int(os.getenv("PAUL_ONBOARDING_SESSION_CAP", "8"))
    created_at = _parse_user_timestamp(user.get("created_at"))
    now = datetime.now(timezone.utc)

    is_within_onboarding_window = False
    if created_at:
        is_within_onboarding_window = (now - created_at).total_seconds() <= onboarding_days * 86400

    active = is_within_onboarding_window and prior_action_count < onboarding_session_cap

    if not active:
        return {"active": False, "stage": "normal"}

    if prior_action_count <= 2:
        stage = "expectation_setting"
    else:
        stage = "light_context_building"

    return {"active": True, "stage": stage}


def _build_last_topic_hint(conversations: list[IConversation]) -> str:
    last_item = _get_last_conversation(conversations)
    if not last_item:
        return ""

    role = last_item.get("role", "unknown")
    content = str(last_item.get("content") or "").strip()
    if not content:
        return ""

    if len(content) > 220:
        content = f"{content[:217].rstrip()}..."

    return f"The most recent {role} message was: {content}"


def _build_opening_mode_instruction(
    chat_history: list[IConversation],
    *,
    current_job: IJob | None = None,
) -> str:
    hours_since_last = _hours_since_last_conversation(chat_history)

    if current_job:
        return (
            "OPENING MODE: scheduled activity.\n"
            "Open directly into the scheduled activity in 1-2 short sentences.\n"
            "Do not give a generic greeting.\n"
            "Do not introduce yourself.\n"
            "Do not explain that you are an AI.\n"
            "Do not mention internal scheduling.\n"
            "Be proactive and gently directive: lead the patient into the activity right away."
        )

    if hours_since_last is not None and hours_since_last <= 2:
        return (
            "OPENING MODE: immediate continuation.\n"
            "Treat this as the conversation resuming, not restarting.\n"
            "Do not greet, introduce yourself, or explain who you are.\n"
            "Respond in 1-2 short sentences that continue the thread or nudge the patient into a concrete topic."
        )

    if hours_since_last is not None and hours_since_last <= 24:
        return (
            "OPENING MODE: same-day re-entry.\n"
            "Re-enter naturally and briefly.\n"
            "Do not use a stock introduction or AI disclaimer.\n"
            "Use 1-2 short sentences to pick up a prior topic or confidently suggest the next thing to talk about."
        )

    if chat_history:
        return (
            "OPENING MODE: returning conversation.\n"
            "Start fresh but not from zero.\n"
            "Do not repeat the same scripted opening.\n"
            "Do not introduce yourself unless the patient explicitly asks or is clearly confused.\n"
            "Use 1-2 short sentences and quickly move into a concrete topic."
        )

    return (
        "OPENING MODE: first conversation on this transport.\n"
        "Start naturally in 1-2 short sentences.\n"
        "Be warm and grounded, but avoid sounding scripted or over-explanatory.\n"
        "Do not volunteer an AI disclaimer unless directly asked."
    )


def _build_onboarding_guidance(engine_state: dict[str, Any]) -> str:
    if not engine_state["active"]:
        return ""

    return (
        "EARLY DAYS CONVERSATION MODE:\n"
        "The patient is still in the first few days of using Paul.\n"
        "Do not dump the whole onboarding in one monologue.\n"
        "Handle only one small trust-building or orientation beat at a time.\n"
        "One question at a time.\n"
        "Offer a short example reply when you ask something personal.\n"
        "Offer an escape hatch such as 'no pressure' or 'we can come back to it'.\n"
        "Reflect the answer back briefly so the patient feels heard.\n"
        "Be direct, warm, grounded, and a bit nudging.\n"
        "Never be patronising."
    )


def _build_onboarding_stage_guidance(engine_state: dict[str, Any]) -> str:
    stage = engine_state["stage"]
    if stage == "first_contact":
        return (
            "EARLY DAYS STAGE: first contact.\n"
            "You may briefly introduce yourself and briefly explain that you are an AI, but do it once only.\n"
            "Keep the whole opening concise.\n"
            "After that, move quickly into a simple expectation-setting line or one easy get-to-know-you question.\n"
            "Do not deliver a long speech."
        )
    if stage == "expectation_setting":
        return (
            "EARLY DAYS STAGE: expectation setting.\n"
            "Assume the patient already basically knows who you are.\n"
            "Do not re-introduce yourself.\n"
            "Focus on one practical piece of how Paul works, or one small trust-building question."
        )
    if stage == "light_context_building":
        return (
            "EARLY DAYS STAGE: light context building.\n"
            "No introductions.\n"
            "Use the conversation to gently learn preferences, relationships, and routines in a natural way."
        )
    return ""


def _build_first_contact_script(user: dict[str, Any]) -> str:
    patient = user.get("patient") or {}
    patient_name = patient.get("name") or "there"
    return "\n".join(
        [
            "THIS IS THE VERY FIRST INTERACTION EVER ON THIS TRANSPORT.",
            "Your first response should closely follow this structure and should not improvise a totally different opener.",
            "Keep the tone direct, warm, grounded, and natural.",
            "Do not sound corporate, childish, or over-excited.",
            "Use short sentences.",
            "Write the opening as natural spoken dialogue, not as commentary about what you will do.",
            "",
            "FIRST RESPONSE PLAN:",
            f'1. Say: "Hey {patient_name}. I\'m Paul."',
            '2. Say that you are going to be around from now on as a bit of company, and that you can chat, tell them things, remind them of stuff, or just be there if they want someone to talk to.',
            '3. Say clearly and honestly that you are not a real person and that you are an AI.',
            '4. Say that you can listen, understand, and have a proper conversation, and that they should give you a chance and see how it goes.',
            '5. Briefly set expectations: you will check in during the day, might suggest things to talk about, might remind them about things, and they can just start talking whenever they want.',
            '6. Acknowledge that talking to a device can feel a bit strange at first, and that there is no pressure.',
            '7. Then move into one simple trust-building question, such as what people usually call them.',
            "",
            "IMPORTANT:",
            "Do not compress this into a vague one-liner.",
            "Do not skip the AI honesty bit.",
            "Do not ask multiple personal questions at once.",
            "Do not go into a scheduled activity here unless one is explicitly attached.",
            'Do not start with generic lines like "How\'s it going" or "I\'m here if you fancy a chat."',
        ]
    )


def _build_personality_context(personality: dict[str, Any] | None) -> dict[str, Any] | None:
    if not personality:
        return None
    return {
        "personality_id": personality.get("personality_id"),
        "key": personality.get("key"),
        "voice": personality.get("voice"),
        "provider": personality.get("provider"),
        "voice_description": personality.get("voice_description"),
        "title": personality.get("title"),
        "subtitle": personality.get("subtitle"),
        "short_description": personality.get("short_description"),
        "character_prompt": personality.get("character_prompt"),
        "voice_prompt": personality.get("voice_prompt"),
        "accent": personality.get("accent"),
        "tone": personality.get("tone"),
        "creator_id": personality.get("creator_id"),
        "pitch_factor": personality.get("pitch_factor"),
        "first_message_prompt": personality.get("first_message_prompt"),
    }


def _build_voice_context(user: dict[str, Any]) -> dict[str, Any]:
    personality = user.get("personality") or {}
    return {
        "voice_prompt": personality.get("voice_prompt", ""),
        "voice_description": personality.get("voice_description", ""),
        "voice": personality.get("voice", ""),
        "provider": personality.get("provider", ""),
        "accent": personality.get("accent", ""),
        "tone": personality.get("tone", []),
        "pitch_factor": personality.get("pitch_factor", 1),
    }


def _build_patient_context(patient: dict[str, Any] | None) -> dict[str, Any] | None:
    if not patient:
        return None
    return {
        "patient_id": patient.get("patient_id"),
        "name": patient.get("name"),
        "age": patient.get("age"),
        "about": patient.get("about"),
        "gender": patient.get("gender"),
        "address": patient.get("address"),
        "jobs": patient.get("jobs"),
        "relations": patient.get("relations"),
        "stories": patient.get("stories"),
        "avoid": patient.get("avoid"),
        "caregiver_id": patient.get("caregiver_id"),
        "timezone": patient.get("timezone"),
    }


def _build_caregiver_context(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "user_id": user.get("user_id"),
        "avatar_url": user.get("avatar_url"),
        "is_premium": user.get("is_premium"),
        "email": user.get("email"),
        "name": user.get("name"),
        "user_info": user.get("user_info"),
        "personality_id": user.get("personality_id"),
        "language_code": user.get("language_code"),
        "language": user.get("language"),
        "device_id": user.get("device_id"),
        "device": user.get("device"),
        "patient_id": user.get("patient_id"),
    }


def _format_context_block(title: str, value: Any) -> str:
    return f"{title}\n{json.dumps(value, indent=2)}"


def _build_news_grounding_instruction(user: dict[str, Any], current_job: IJob | None) -> str:
    if not current_job or current_job.get("type") != "conversation_news":
        return ""

    patient = user.get("patient") or {}
    location = patient.get("address") or patient.get("timezone") or "the patient's local area"
    return (
        "LOCAL NEWS GROUNDING:\n"
        f"This is a scheduled local news conversation for {location}.\n"
        "Use Google Search grounding for this turn so the news is current and locally relevant.\n"
        "Prefer lightweight local topics such as weather impacts, community events, transport, culture, sports, or non-distressing headlines.\n"
        "Avoid alarming or graphic stories unless the caregiver instructions explicitly ask for them.\n"
        "Open by briefly mentioning one current local news item and then ask one short follow-up question."
    )


def create_first_message(
    user: dict[str, Any],
    chat_history: list[IConversation],
    action_type: ActionTransportType,
    current_job: IJob | None = None,
    prior_action_count: int = 0,
) -> str:
    base_prompt = (user.get("personality") or {}).get("first_message_prompt", "") or ""
    history_label = "device chat history" if action_type == "device_chat" else "web chat history"
    recent_chat_history = _compose_recent_chat_history(chat_history)
    last_topic_hint = _build_last_topic_hint(chat_history)
    opening_mode_instruction = _build_opening_mode_instruction(
        chat_history,
        current_job=current_job,
    )
    engine_state = _build_engine_state(
        user,
        prior_action_count=prior_action_count,
        chat_history=chat_history,
    )

    style_guidance = (
        "Use the personality's first_message_prompt only as tone/style guidance. "
        "It is not a script and must not be repeated verbatim across sessions."
    )
    early_days_guidance = _build_onboarding_guidance(engine_state)
    early_days_stage_guidance = _build_onboarding_stage_guidance(engine_state)
    first_contact_script = _build_first_contact_script(user)
    news_grounding_instruction = _build_news_grounding_instruction(user, current_job)

    if current_job:
        job_summary = {
            "job_id": current_job.get("job_id"),
            "type": current_job.get("type"),
            "title": current_job.get("title"),
            "instructions": current_job.get("instructions"),
        }
        return "\n\n".join(
            part
            for part in [
                opening_mode_instruction,
                style_guidance,
                early_days_guidance,
                early_days_stage_guidance,
                (
                    "For a scheduled activity, keep the opening especially short and lead with the activity. "
                    "If early-days guidance is active, do not run a separate intro here."
                ),
                news_grounding_instruction,
                f"STYLE GUIDANCE:\n{base_prompt}" if base_prompt else "",
                last_topic_hint,
                f"THIS IS THE MOST RECENT {history_label.upper()} CONTEXT:\n{recent_chat_history}"
                if recent_chat_history
                else "",
                f"SCHEDULED ACTIVITY:\n{json.dumps(job_summary, indent=2)}",
            ]
            if part
        )

    if recent_chat_history:
        return "\n\n".join(
            part
            for part in [
                opening_mode_instruction,
                style_guidance,
                early_days_guidance,
                early_days_stage_guidance,
                f"STYLE GUIDANCE:\n{base_prompt}" if base_prompt else "",
                last_topic_hint,
                f"THIS IS THE MOST RECENT {history_label.upper()} CONTEXT:\n{recent_chat_history}",
            ]
            if part
        )

    if engine_state["stage"] == "first_contact":
        return "\n\n".join(
            part
            for part in [
                style_guidance,
                early_days_guidance,
                early_days_stage_guidance,
                first_contact_script,
                f"STYLE GUIDANCE:\n{base_prompt}" if base_prompt else "",
            ]
            if part
        )

    return "\n\n".join(
        part
        for part in [
            opening_mode_instruction,
            style_guidance,
            early_days_guidance,
            early_days_stage_guidance,
            f"STYLE GUIDANCE:\n{base_prompt}" if base_prompt else "",
        ]
        if part
    )


def create_system_prompt(
    user: IUser,
    chat_history: list[IConversation],
    action_type: ActionTransportType,
    current_job: IJob | None = None,
    prior_action_count: int = 0,
) -> str:
    chat_history_string = compose_chat_history(chat_history)
    history_label = (
        "THIS IS THE DEVICE CHAT HISTORY (LAST 30 MESSAGES):"
        if action_type == "device_chat"
        else "THIS IS THE WEB CHAT HISTORY (LAST 30 MESSAGES):"
    )
    engine_state = _build_engine_state(
        user,
        prior_action_count=prior_action_count,
        chat_history=chat_history,
    )
    early_days_section = (
        "EARLY DAYS CONVERSATION MODE:\n"
        "This user is still in the first few days of using Paul.\n"
        "Spread early trust-building and orientation over multiple sessions instead of front-loading it.\n"
        "For self-initiated chats, you can spend one small beat on setting expectations, acknowledging the weirdness, building trust, or learning personal context.\n"
        "One question at a time.\n"
        "Offer an example reply.\n"
        "Offer an escape hatch.\n"
        "Reflect answers briefly.\n"
        "Never deliver the full intro monologue again after first contact.\n"
        "Scheduled activity sessions should stay primarily about the activity, even during the early-days period."
    ) if engine_state["active"] else (
        "EARLY DAYS CONVERSATION MODE:\n"
        "Normal conversation mode is active. The dedicated early-days period has ended."
    )
    first_contact_section = (
        "FIRST CONTACT REQUIREMENT:\n"
        "If there is no conversation history and this is the first contact stage, your first reply should explicitly introduce Paul, honestly say that he is an AI, set expectations about check-ins and reminders, acknowledge the weirdness, and then ask one simple trust-building question.\n"
        "Do not replace this with a vague greeting.\n"
        "Do not omit the AI honesty bit.\n"
        "Do not collapse it into a single sentence."
    ) if engine_state["stage"] == "first_contact" else (
        "FIRST CONTACT REQUIREMENT:\n"
        "This is not the very first interaction, so do not fall back to a generic intro."
    )
    news_grounding_section = _build_news_grounding_instruction(user, current_job)

    return "\n\n".join(
        [
            _format_context_block(
                "YOU ARE (PERSONALITY CONTEXT):",
                _build_personality_context(user.get("personality")),
            ),
            _format_context_block(
                "YOUR VOICE (VOICE DETAILS):",
                _build_voice_context(user),
            ),
            _format_context_block(
                "YOU ARE TALKING TO (PATIENT DETAILS):",
                _build_patient_context(user.get("patient")),
            ),
            _format_context_block(
                "THE PATIENT'S CAREGIVER (USER DETAILS):",
                _build_caregiver_context(user),
            ),
            (
                "CONVERSATION ENGINE:\n"
                "If there is chat history, continue from it naturally.\n"
                "Do not keep restarting the relationship.\n"
                "Do not repeat the same generic opening line every session.\n"
                "Do not keep repeating your name, what you are, or that you are an AI unless the patient explicitly asks or is clearly confused.\n"
                "For returning chats, use the recent transcript to decide whether to follow up, acknowledge, continue a topic, or gently re-engage.\n"
                "For scheduled chats, open directly into the activity in 1-2 short sentences without a generic preamble.\n"
                "Be proactive and gently nudging rather than passive. Offer a concrete next direction instead of broad generic chatter."
            ),
            early_days_section,
            first_contact_section,
            news_grounding_section,
            _format_context_block(
                "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):",
                current_job,
            )
            if current_job
            else "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):\nNo scheduled job is attached to this session.",
            f"{history_label}\n{chat_history_string or 'No chat history yet.'}",
        ]
    )
