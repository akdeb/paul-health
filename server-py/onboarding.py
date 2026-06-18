"""Stateful onboarding checklist helpers."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

ONBOARDING_CHECKLIST_COLUMN = "checklist"

ONBOARDING_ITEMS: list[dict[str, Any]] = [
    {
        "key": "identity_and_role",
        "title": "Introduce Paul",
        "prompt": (
            "Say the patient's name if known, introduce yourself as Paul, and explain that "
            "you will be around as company: chatting, telling them things, reminding them "
            "about things, or just being there if they want someone to talk to."
        ),
        "completion": "Complete once Paul has clearly introduced himself and his day-to-day role.",
    },
    {
        "key": "ai_disclosure",
        "title": "Disclose AI identity",
        "prompt": (
            "Clearly and lightly say that you are not a real person and that you are an AI. "
            "Do not be defensive or over-explain it."
        ),
        "completion": "Complete once the AI disclosure has been said plainly.",
    },
    {
        "key": "conversation_capability",
        "title": "Explain conversation ability",
        "prompt": (
            "Explain that you can listen, understand, and have a proper conversation. "
            "Keep it grounded and short."
        ),
        "completion": "Complete once Paul has set trust around listening and conversation.",
    },
    {
        "key": "proactive_checkins",
        "title": "Set check-in expectation",
        "prompt": (
            "Explain that Paul will check in during the day with quick, low-pressure "
            "check-ins and may suggest something to chat about."
        ),
        "completion": "Complete once the patient knows Paul may initiate check-ins.",
    },
    {
        "key": "reminders_and_day_context",
        "title": "Explain reminders and day context",
        "prompt": (
            "Mention that Paul may remind them about something, tell them what day it is, "
            "or say what is happening."
        ),
        "completion": "Complete once reminders/day context have been explained.",
    },
    {
        "key": "how_to_interact",
        "title": "Explain how to talk",
        "prompt": (
            "Explain that if they ever want to talk, they can just start talking. "
            "Do not teach a special wake phrase."
        ),
        "completion": "Complete once the patient knows they do not need special words.",
    },
    {
        "key": "escape_hatches",
        "title": "Give escape hatches",
        "prompt": (
            "Tell them they can stop, come back later, or tell Paul to shut up if he is "
            "annoying them. Keep it direct and human."
        ),
        "completion": "Complete once the patient has been given clear permission to stop or push back.",
    },
    {
        "key": "acknowledge_weirdness",
        "title": "Acknowledge weirdness",
        "prompt": (
            "Acknowledge that talking to a device can feel strange at first, and that it is "
            "fine if it does not feel normal immediately."
        ),
        "completion": "Complete once the weirdness has been acknowledged without making a big deal of it.",
    },
    {
        "key": "preferred_name",
        "title": "Ask preferred name",
        "prompt": (
            "Ask what people usually call them: their known name or something else. "
            "Offer an example answer and no pressure."
        ),
        "completion": "Complete only after the patient answers, confirms, corrects, or declines.",
    },
    {
        "key": "important_people",
        "title": "Ask important people",
        "prompt": (
            "Ask who the important people are in their life or who they see most. "
            "Ask one gentle follow-up about the first person they mention."
        ),
        "completion": "Complete only after the patient answers or explicitly declines.",
    },
    {
        "key": "interests",
        "title": "Ask interests",
        "prompt": (
            "Ask what they enjoy: music, sport, gardening, a good film, or anything else. "
            "Offer examples and keep it normal."
        ),
        "completion": "Complete only after the patient answers or explicitly declines.",
    },
    {
        "key": "emotional_checkin",
        "title": "Ask first emotional check-in",
        "prompt": (
            "Ask how they are feeling right now. Match their energy: good to hear, fair enough, "
            "or no need to be anywhere other than where they are."
        ),
        "completion": "Complete only after the patient gives a feeling or declines to answer.",
    },
    {
        "key": "close_intro",
        "title": "Close onboarding intro",
        "prompt": (
            "Close the intro clearly: questions are done for now, Paul will be around and "
            "will check in later, and they can start talking whenever they want."
        ),
        "completion": "Complete once the intro has been closed after the earlier required items.",
    },
]

ONBOARDING_ITEM_BY_KEY = {item["key"]: item for item in ONBOARDING_ITEMS}

MARK_ONBOARDING_ITEM_TOOL: dict[str, Any] = {
    "name": "mark_onboarding_item_complete",
    "description": (
        "Mark one required Paul onboarding checklist item complete after it has been covered, "
        "acknowledged, answered, or explicitly declined by the patient."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "key": {
                "type": "string",
                "description": "The exact onboarding item key to mark complete.",
                "enum": [item["key"] for item in ONBOARDING_ITEMS],
            }
        },
        "required": ["key"],
    },
}


def default_onboarding_checklist() -> list[dict[str, Any]]:
    return [
        {
            "key": item["key"],
            "complete": False,
        }
        for item in ONBOARDING_ITEMS
    ]


def normalize_onboarding_checklist(value: Any) -> list[dict[str, Any]]:
    raw_items = value if isinstance(value, list) else []
    by_key: dict[str, dict[str, Any]] = {}

    for item in raw_items:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        if key in ONBOARDING_ITEM_BY_KEY:
            by_key[key] = {
                "key": key,
                "complete": bool(item.get("complete")),
                **({"completed_at": item["completed_at"]} if item.get("completed_at") else {}),
            }

    normalized: list[dict[str, Any]] = []
    for item in ONBOARDING_ITEMS:
        normalized.append(by_key.get(item["key"], {"key": item["key"], "complete": False}))
    return normalized


def get_onboarding_state(user: dict[str, Any]) -> dict[str, Any]:
    patient = user.get("patient") or {}
    checklist = normalize_onboarding_checklist(patient.get(ONBOARDING_CHECKLIST_COLUMN))
    completed_keys = [item["key"] for item in checklist if item.get("complete")]
    incomplete_keys = [item["key"] for item in checklist if not item.get("complete")]
    next_key = incomplete_keys[0] if incomplete_keys else None

    return {
        "active": bool(incomplete_keys),
        "checklist": checklist,
        "completed_keys": completed_keys,
        "incomplete_keys": incomplete_keys,
        "next_key": next_key,
        "next_item": deepcopy(ONBOARDING_ITEM_BY_KEY.get(next_key)) if next_key else None,
        "incomplete_items": [deepcopy(ONBOARDING_ITEM_BY_KEY[key]) for key in incomplete_keys],
    }


def build_onboarding_prompt_block(user: dict[str, Any]) -> str:
    state = get_onboarding_state(user)
    if not state["active"]:
        return (
            "ONBOARDING CHECKLIST:\n"
            "All required onboarding items are complete. Use the normal conversation engine."
        )

    next_item = state["next_item"] or {}
    incomplete_lines = []
    for item in state["incomplete_items"]:
        marker = "NEXT" if item["key"] == state["next_key"] else "pending"
        incomplete_lines.append(
            f"- {marker}: {item['key']} - {item['title']}: {item['prompt']}"
        )

    return "\n".join(
        [
            "ONBOARDING CHECKLIST:",
            "The patient has not completed onboarding yet. The checklist is the active conversation plan.",
            "Do not enter the normal conversation flow until every checklist item is complete.",
            "Do one onboarding item at a time. Do not dump the whole onboarding flow.",
            "If the patient digresses, respond naturally and briefly, then steer back to the next incomplete onboarding item when it is not awkward.",
            "Ask only one question at a time. Offer a short example reply when asking something personal. Always offer an escape hatch.",
            "Reflect the patient's answer briefly before moving on.",
            "Never repeat the same sentence, acknowledgement, or question twice in a single response.",
            "If the patient answered the previous item, acknowledge it once only, then move to the NEXT item.",
            "Move through the checklist in order. The NEXT item has priority over all pending items.",
            "Use caregiver-provided context to personalize gently, but do not read from it. Ask broad questions first and let the patient say things in their own words.",
            "Do not name specific relationships, partners, relatives, or sensitive details as examples unless the patient already mentioned them in this or recent conversation.",
            "Do not repeat completed items unless the patient asks or seems confused.",
            "When an item is clearly covered, acknowledged, answered, or explicitly declined, call mark_onboarding_item_complete with that exact key.",
            "For personal-context items, do not mark complete just because you asked. Mark complete only after the patient answers or explicitly declines.",
            f"Next required item: {next_item.get('key')} - {next_item.get('title')}.",
            "Incomplete items:",
            *incomplete_lines,
            f"Completed keys: {', '.join(state['completed_keys']) or 'none'}.",
        ]
    )


def mark_onboarding_item_complete(
    supabase: Any,
    user: dict[str, Any],
    key: str,
) -> dict[str, Any]:
    normalized_key = str(key or "").strip()
    if normalized_key not in ONBOARDING_ITEM_BY_KEY:
        raise ValueError(f"Unknown onboarding item key: {normalized_key}")

    patient = user.get("patient") or {}
    patient_id = patient.get("patient_id") or user.get("patient_id")
    if not patient_id:
        raise RuntimeError("Cannot update onboarding checklist without patient_id")

    checklist = normalize_onboarding_checklist(patient.get(ONBOARDING_CHECKLIST_COLUMN))
    completed_at = datetime.now(timezone.utc).isoformat()
    for item in checklist:
        if item["key"] == normalized_key:
            item["complete"] = True
            item["completed_at"] = item.get("completed_at") or completed_at

    response = (
        supabase.table("patients")
        .update({ONBOARDING_CHECKLIST_COLUMN: checklist})
        .eq("patient_id", patient_id)
        .execute()
    )
    if response.data:
        updated_patient = response.data[0]
        patient.update(updated_patient)
    else:
        patient[ONBOARDING_CHECKLIST_COLUMN] = checklist

    user["patient"] = patient

    return {
        "success": True,
        "key": normalized_key,
        "complete": True,
        "remaining_keys": [
            item["key"]
            for item in normalize_onboarding_checklist(patient.get(ONBOARDING_CHECKLIST_COLUMN))
            if not item.get("complete")
        ],
    }
