"""Session setup, auth, prompts, and Supabase access for the Paul voice server."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from fastapi import WebSocket
from loguru import logger
from supabase import Client, create_client
from supabase.client import ClientOptions

from app_types import (
    ActionTransportType,
    IConversation,
    IJob,
    IPatientPhotoContext,
    IUser,
)
from cache import (
    append_cached_chat_history,
    get_cached_chat_history,
    get_cached_user_context,
    set_cached_chat_history,
    set_cached_user_context,
)


def _base64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def verify_hs256_jwt(token: str, secret: str) -> dict[str, Any]:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise ValueError("Invalid JWT structure") from exc

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    actual_signature = _base64url_decode(signature_b64)

    if not hmac.compare_digest(expected_signature, actual_signature):
        raise ValueError("JWT signature verification failed")

    payload = json.loads(_base64url_decode(payload_b64))
    exp = payload.get("exp")
    if exp is not None and int(exp) < int(time.time()):
        raise ValueError("JWT has expired")

    return payload


def get_supabase_client(user_jwt: str) -> Client:
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_key = os.environ["SUPABASE_KEY"]
    return create_client(
        supabase_url,
        supabase_key,
        options=ClientOptions(
            headers={"Authorization": f"Bearer {user_jwt}"},
            auto_refresh_token=False,
            persist_session=False,
        ),
    )


def get_user_by_email(supabase: Client, email: str) -> IUser:
    response = (
        supabase.table("users")
        .select(
            "*,"
            "language:languages(name),"
            "personality:personalities!users_personality_id_fkey(*),"
            "device:devices!users_device_id_fkey(*),"
            "patient:patients!users_patient_id_fkey(*)"
        )
        .eq("email", email)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to authenticate user")
    return response.data[0]


def authenticate_user(supabase: Client, auth_token: str) -> IUser:
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY not configured")

    payload = verify_hs256_jwt(auth_token, jwt_secret)
    email = payload.get("email")
    if not email:
        raise RuntimeError("JWT payload missing email")
    return get_user_by_email(supabase, email)


def get_email_from_auth_token(auth_token: str) -> str:
    jwt_secret = os.getenv("JWT_SECRET_KEY")
    if not jwt_secret:
        raise RuntimeError("JWT_SECRET_KEY not configured")

    payload = verify_hs256_jwt(auth_token, jwt_secret)
    email = payload.get("email")
    if not email:
        raise RuntimeError("JWT payload missing email")
    return str(email)


def get_chat_history(
    supabase: Client,
    user_id: str,
    action_type: ActionTransportType,
) -> list[IConversation]:
    try:
        actions_response = (
            supabase.table("actions")
            .select("action_id")
            .eq("user_id", user_id)
            .eq("type", action_type)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        action_ids = [
            action["action_id"]
            for action in (actions_response.data or [])
            if action.get("action_id")
        ]
        if not action_ids:
            return []

        response = (
            supabase.table("conversations")
            .select("*")
            .in_("action_id", action_ids)
            .order("created_at", desc=True)
            .limit(30)
            .execute()
        )
        return response.data or []
    except Exception as exc:
        logger.warning("Failed to load chat history: {}", exc)
        return []


def get_patient_photos(
    supabase: Client,
    patient_id: str | None,
) -> list[IPatientPhotoContext]:
    # Keep image bytes off the websocket/session bootstrap path.
    # We can add a dedicated lazy image-loading path when the live route
    # actually consumes patient photos again.
    return []


def get_device_info(supabase: Client, user_id: str) -> dict[str, Any] | None:
    try:
        response = (
            supabase.table("devices")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]
    except Exception as exc:
        logger.warning("Failed to fetch device info: {}", exc)
        return None


def get_job_by_id(supabase: Client, job_id: str | None) -> IJob | None:
    if not job_id:
        return None

    try:
        response = (
            supabase.table("jobs")
            .select("job_id, patient_id, type, title, instructions, cron, enabled")
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]
    except Exception as exc:
        logger.warning("Failed to fetch job {}: {}", job_id, exc)
        return None


def compose_chat_history(conversations: list[IConversation]) -> str:
    return "\n".join(
        f"{item.get('role', 'unknown')} [{datetime.fromisoformat(str(item['created_at']).replace('Z', '+00:00')).isoformat()}]: {item.get('content', '')}"
        for item in conversations
        if item.get("created_at")
    )


def create_first_message(user: dict[str, Any]) -> str:
    return (user.get("personality") or {}).get("first_message_prompt", "") or ""


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


def create_system_prompt(
    user: IUser,
    chat_history: list[IConversation],
    action_type: ActionTransportType,
    current_job: IJob | None = None,
) -> str:
    chat_history_string = compose_chat_history(chat_history)
    history_label = (
        "THIS IS THE DEVICE CHAT HISTORY (LAST 30 MESSAGES):"
        if action_type == "device_chat"
        else "THIS IS THE WEB CHAT HISTORY (LAST 30 MESSAGES):"
    )
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
            _format_context_block(
                "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):",
                current_job,
            )
            if current_job
            else "THIS IS THE CURRENT SCHEDULED ACTIVITY (JOB CONTEXT):\nNo scheduled job is attached to this session.",
            f"{history_label}\n{chat_history_string or 'No chat history yet.'}",
        ]
    )


def create_action(
    supabase: Client,
    *,
    user_id: str,
    action_type: ActionTransportType,
    metadata: dict[str, Any] | None = None,
    session_time: int = 0,
    job_id: str | None = None,
) -> dict[str, Any]:
    response = (
        supabase.table("actions")
        .insert(
            {
                "user_id": user_id,
                "type": action_type,
                "metadata": metadata or {},
                "session_time": session_time,
                "job_id": job_id,
            }
        )
        .execute()
    )
    if not response.data:
        raise RuntimeError("Failed to create action")
    return response.data[0]


def add_conversation(
    supabase: Client,
    *,
    speaker: Literal["user", "assistant"],
    content: str,
    action_id: str,
    user_id: str | None = None,
) -> None:
    text = content.strip()
    if not text:
        return

    (
        supabase.table("conversations")
        .insert(
            {
                "role": speaker,
                "content": text,
                "action_id": action_id,
                "is_sensitive": False,
            }
        )
        .execute()
    )

    if user_id:
        append_cached_chat_history(
            user_id,
            [
                {
                    "conversation_id": "",
                    "role": speaker,
                    "content": text,
                    "is_sensitive": False,
                    "action_id": action_id,
                    "metadata": None,
                    "created_at": datetime.utcnow().isoformat() + "+00:00",
                }
            ],
        )


def update_action_session_time(
    supabase: Client,
    *,
    action_id: str,
    session_time: int,
) -> None:
    (
        supabase.table("actions")
        .update({"session_time": max(0, int(session_time))})
        .eq("action_id", action_id)
        .execute()
    )


def extract_auth_token(websocket: WebSocket) -> str:
    authorization = websocket.headers.get("authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        return authorization[7:].strip()

    for key in ("token", "auth_token", "access_token"):
        value = websocket.query_params.get(key)
        if value:
            return value.strip()

    return ""


def normalize_optional_uuid_header(value: str | None) -> str | None:
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    if normalized.lower() in {"null", "none", "undefined"}:
        return None

    return normalized


@dataclass
class SessionState:
    transport_kind: Literal["browser", "esp32"]
    action_type: ActionTransportType
    user: IUser
    supabase: Client
    auth_token: str
    action_id: str
    action_started_at: float
    system_prompt: str
    first_message: str
    patient_photos: list[IPatientPhotoContext] = field(default_factory=list)
    current_job: IJob | None = None
    job_id: str | None = None
    cleaned_up: bool = False

    def create_auth_message(self) -> dict[str, Any]:
        device = self.user.get("device") or {}
        personality = self.user.get("personality") or {}
        return {
            "type": "auth",
            "volume_control": device.get("volume", 100),
            "is_ota": device.get("is_ota", False),
            "is_reset": device.get("is_reset", False),
            "pitch_factor": personality.get("pitch_factor", 1),
        }

    async def cleanup(self) -> None:
        if self.cleaned_up:
            return
        self.cleaned_up = True
        session_time = int(max(0, time.time() - self.action_started_at))
        try:
            update_action_session_time(
                self.supabase,
                action_id=self.action_id,
                session_time=session_time,
            )
        except Exception as exc:
            logger.warning("Failed to update action session time: {}", exc)


def build_session_state(
    websocket: WebSocket,
    *,
    transport_kind: Literal["browser", "esp32"],
) -> SessionState:
    auth_token = extract_auth_token(websocket)
    if not auth_token:
        raise RuntimeError("Missing authorization token")

    supabase = get_supabase_client(auth_token)
    email = get_email_from_auth_token(auth_token)
    cached_user_context = get_cached_user_context(email)
    if cached_user_context:
        user = cached_user_context["user"]
        patient_photos = []
    else:
        user = authenticate_user(supabase, auth_token)
        patient_photos = []
        set_cached_user_context(email, user=user)

    action_type: ActionTransportType = "device_chat" if transport_kind == "esp32" else "web_chat"
    job_id = normalize_optional_uuid_header(websocket.headers.get("x-job-id"))
    current_job = get_job_by_id(supabase, job_id)

    action = create_action(
        supabase,
        user_id=user["user_id"],
        action_type=action_type,
        metadata={},
        session_time=0,
        job_id=job_id,
    )
    chat_history = get_cached_chat_history(user["user_id"])
    if chat_history is None:
        chat_history = get_chat_history(supabase, user["user_id"], action_type)
        set_cached_chat_history(user["user_id"], chat_history)

    return SessionState(
        transport_kind=transport_kind,
        action_type=action_type,
        user=user,
        supabase=supabase,
        auth_token=auth_token,
        action_id=action["action_id"],
        action_started_at=time.time(),
        system_prompt=create_system_prompt(user, chat_history, action_type, current_job),
        first_message=create_first_message(user),
        patient_photos=patient_photos,
        current_job=current_job,
        job_id=job_id,
    )
