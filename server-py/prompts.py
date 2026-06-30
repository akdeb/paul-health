"""Conversation prompt builders for Paul."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from app_types import ActionTransportType, IConversation, IJob, IUser
from memory import memory_tool_instructions, recall_memories_block
from onboarding import build_onboarding_prompt_block, get_onboarding_state


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


def _build_reentry_acknowledgement_instruction(
    chat_history: list[IConversation],
) -> str:
    hours_since_last = _hours_since_last_conversation(chat_history)
    if hours_since_last is None:
        return (
            "RE-ENTRY CONTEXT:\n"
            "No prior conversation is available. Do not pretend you remember one."
        )

    if hours_since_last <= 2:
        label = "within the last couple of hours"
        example = "We were just talking a little while ago."
    elif hours_since_last <= 24:
        label = "earlier today"
        example = "It's been a few hours."
    elif hours_since_last <= 72:
        label = "a day or two ago"
        example = "It's been a day or two."
    elif hours_since_last <= 24 * 14:
        label = "a few days ago"
        example = "It's been a few days."
    elif hours_since_last <= 24 * 60:
        label = "a few weeks ago"
        example = "It's been a few weeks."
    else:
        label = "a few months or more since the last chat"
        example = "It's been a while."

    return (
        "RE-ENTRY CONTEXT:\n"
        f"The last conversation was {label}.\n"
        f"Acknowledge that naturally before moving on, in one short clause. Example style: \"{example}\"\n"
        "Do not overdo it. Do not apologize for the gap unless the patient brings it up."
    )


def _build_engine_state(
    user: IUser,
    *,
    prior_action_count: int,
    chat_history: list[IConversation],
) -> dict[str, Any]:
    onboarding_state = get_onboarding_state(user)
    if not onboarding_state["active"]:
        return {**onboarding_state, "stage": "normal"}

    next_key = onboarding_state["next_key"]
    if prior_action_count == 0 and not chat_history and next_key == "identity_and_role":
        stage = "first_contact"
    elif next_key in {
        "identity_and_role",
        "ai_disclosure",
        "conversation_capability",
        "proactive_checkins",
        "reminders_and_day_context",
        "how_to_interact",
        "escape_hatches",
        "acknowledge_weirdness",
    }:
        stage = "orientation"
    elif next_key in {"preferred_name", "important_people", "interests", "emotional_checkin"}:
        stage = "context_building"
    else:
        stage = "close_onboarding"

    return {**onboarding_state, "stage": stage}


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
    onboarding_state: dict[str, Any] | None = None,
) -> str:
    hours_since_last = _hours_since_last_conversation(chat_history)
    reentry_instruction = _build_reentry_acknowledgement_instruction(chat_history)

    if current_job:
        if onboarding_state and onboarding_state.get("active"):
            return (
                "OPENING MODE: scheduled activity with onboarding still incomplete.\n"
                f"{reentry_instruction}\n"
                "Open directly into the scheduled activity in 1-2 short sentences.\n"
                "Do not give a generic greeting.\n"
                "Do not introduce yourself or explain that you are an AI before the activity.\n"
                "After the scheduled activity has clearly started, return to the next incomplete onboarding checklist item when it fits.\n"
                "Do not treat the session as normal open-ended conversation until onboarding is complete."
            )
        return (
            "OPENING MODE: scheduled activity.\n"
            "Open directly into the scheduled activity in 1-2 short sentences.\n"
            "Do not give a generic greeting.\n"
            "Do not introduce yourself.\n"
            "Do not explain that you are an AI.\n"
            "Do not mention internal scheduling.\n"
            "Be proactive and gently directive: lead the patient into the activity right away."
        )

    if onboarding_state and onboarding_state.get("active"):
        next_item = onboarding_state.get("next_item") or {}
        return (
            "OPENING MODE: onboarding checklist continuation.\n"
            f"{reentry_instruction}\n"
            "If this is not first contact, first acknowledge the time gap naturally, then continue with the next incomplete onboarding item.\n"
            "Keep it short and spoken. It should feel like a person picking the thread back up.\n"
            "Do not repeat the same acknowledgement, reflection, or question twice in the same response.\n"
            "If this is the first contact, follow the first-contact script. Otherwise do only one small onboarding beat.\n"
            f"Next item: {next_item.get('key')} - {next_item.get('title')}."
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


def _build_onboarding_stage_guidance(engine_state: dict[str, Any]) -> str:
    stage = engine_state["stage"]
    if stage == "first_contact":
        return (
            "ONBOARDING STAGE: first contact.\n"
            "Follow the first-contact script closely enough that the patient understands who Paul is, what Paul does, and that Paul is an AI.\n"
            "Keep it warm and spoken, but do not collapse it into a vague one-liner.\n"
            "After the orientation beats, ask only one easy get-to-know-you question."
        )
    if stage == "orientation":
        return (
            "ONBOARDING STAGE: orientation.\n"
            "Focus on the next practical piece of how Paul works.\n"
            "Do not re-run completed orientation items."
        )
    if stage == "context_building":
        return (
            "ONBOARDING STAGE: context building.\n"
            "No introductions.\n"
            "Ask the next personal-context question naturally.\n"
            "Offer an example reply and an escape hatch.\n"
            "Ask broadly first. Do not lead with caregiver-provided names or relationships unless the patient has already brought them up."
        )
    if stage == "close_onboarding":
        return (
            "ONBOARDING STAGE: close onboarding.\n"
            "Briefly close the intro and hand off to normal conversation.\n"
            "Say the closing once only. Do not restate it in a second wording."
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


def _build_scheduled_job_system_guidance(user: IUser, current_job: IJob | None) -> str:
    if not current_job:
        return ""

    title = current_job.get("title") or ""
    instructions = (current_job.get("instructions") or "").strip()

    parts = [
        "SCHEDULED ACTIVITY GUIDANCE:",
        "This is a scheduled activity. Lead directly into it in 1-2 short sentences.",
        "Do not give a generic greeting or restart the relationship.",
    ]
    if title:
        parts.append(f"Job title: {title}.")
    if instructions:
        parts.append(f"Job-specific instructions: {instructions}")
    return "\n".join(parts)


def _build_scheduled_job_first_turn(
    user: IUser,
    current_job: IJob,
    *,
    recent_chat_history: str,
) -> str:
    title = current_job.get("title") or ""
    instructions = (current_job.get("instructions") or "").strip()

    parts = [
        "Start the scheduled activity now.",
        "Lead directly with the activity in 1-2 short sentences.",
        "Do not give a generic greeting.",
    ]
    if title:
        parts.append(f"Title: {title}.")
    if instructions:
        parts.append(f"Instructions: {instructions}")
    if recent_chat_history:
        parts.append("If relevant, keep continuity with the recent conversation naturally.")
    return " ".join(parts)


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
    engine_state = _build_engine_state(
        user,
        prior_action_count=prior_action_count,
        chat_history=chat_history,
    )
    opening_mode_instruction = _build_opening_mode_instruction(
        chat_history,
        current_job=current_job,
        onboarding_state=engine_state,
    )

    style_guidance = (
        "Use the personality's first_message_prompt only as tone/style guidance. "
        "It is not a script and must not be repeated verbatim across sessions."
    )
    early_days_stage_guidance = _build_onboarding_stage_guidance(engine_state)
    first_contact_script = _build_first_contact_script(user)
    if current_job:
        return "\n\n".join(
            part
            for part in [
                opening_mode_instruction,
                style_guidance,
                early_days_stage_guidance,
                (
                    "For a scheduled activity, keep the opening especially short and lead with the activity. "
                    "If onboarding is active, do not run a separate intro before the activity. "
                    "After the activity has started, continue the next checklist item when it fits."
                ),
                f"STYLE GUIDANCE:\n{base_prompt}" if base_prompt else "",
                last_topic_hint,
                _build_scheduled_job_first_turn(
                    user,
                    current_job,
                    recent_chat_history=recent_chat_history,
                ),
            ]
            if part
        )

    if recent_chat_history:
        return "\n\n".join(
            part
            for part in [
                opening_mode_instruction,
                style_guidance,
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
    onboarding_section = build_onboarding_prompt_block(user)
    memory_instructions = memory_tool_instructions()
    memory_section = recall_memories_block(user)
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
    scheduled_job_section = _build_scheduled_job_system_guidance(user, current_job)
    reentry_section = _build_reentry_acknowledgement_instruction(chat_history)
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
                "Normal conversation rules apply only after the onboarding checklist is complete.\n"
                "If onboarding is incomplete, follow the onboarding checklist block first and use this section only for style and continuity.\n"
                "Do not satisfy multiple phrasings of the same instruction. If two instructions ask for the same idea, say it once.\n"
                "Sound like an intelligent conversationalist: acknowledge whether it has been hours, days, weeks, or months since the last chat before diving into a new topic.\n"
                "If there is chat history, continue from it naturally.\n"
                "Do not keep restarting the relationship.\n"
                "Do not repeat the same generic opening line every session.\n"
                "Never duplicate the same sentence or question in a single response.\n"
                "Do not keep repeating your name, what you are, or that you are an AI unless the patient explicitly asks or is clearly confused.\n"
                "For returning chats, use the recent transcript to decide whether to follow up, acknowledge, continue a topic, or gently re-engage.\n"
                "For scheduled chats, open directly into the activity in 1-2 short sentences without a generic preamble.\n"
                "Be proactive and gently nudging rather than passive. Offer a concrete next direction instead of broad generic chatter."
            ),
            reentry_section,
            *([memory_instructions] if memory_instructions else []),
            *([memory_section] if memory_section else []),
            onboarding_section,
            first_contact_section,
            scheduled_job_section,
            _format_context_block(
                "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):",
                current_job,
            )
            if current_job
            else "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):\nNo scheduled job is attached to this session.",
            f"{history_label}\n{chat_history_string or 'No chat history yet.'}",
        ]
    )
