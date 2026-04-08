"""Shared typed shapes for the Paul Python server."""

from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict

Role = Literal["user", "assistant"]
ActionType = Literal["device_event", "web_chat", "device_chat"]
ActionTransportType = Literal["web_chat", "device_chat"]
ModelProvider = Literal["openai", "gemini", "elevenlabs", "hume", "grok"]
CareActivityType = Literal[
    "guess_flag",
    "guess_capital",
    "conversation_news",
    "medication_reminder",
    "memory_prompt",
]


class IConversation(TypedDict):
    conversation_id: str
    role: Role
    content: str
    is_sensitive: bool
    action_id: str
    metadata: Any
    created_at: NotRequired[str]


class ActionMetadata(TypedDict, total=False):
    text: str
    ai_summary: str


class IAction(TypedDict):
    action_id: str
    user_id: str
    type: ActionType
    metadata: ActionMetadata
    session_time: int
    job_id: str | None
    created_at: NotRequired[str]


class IDevice(TypedDict, total=False):
    device_id: str
    volume: int
    is_ota: bool
    is_reset: bool
    mac_address: str
    user_code: str
    user_id: str | None


class IPersonality(TypedDict, total=False):
    personality_id: str
    key: str
    voice: str
    provider: ModelProvider
    voice_description: str
    title: str
    subtitle: str
    short_description: str
    character_prompt: str
    voice_prompt: str
    accent: str
    tone: list[str]
    creator_id: str | None
    pitch_factor: float
    first_message_prompt: str


class ILanguage(TypedDict, total=False):
    language_id: str
    code: str
    name: str
    flag: str


class IPatient(TypedDict, total=False):
    patient_id: str
    name: str
    age: int
    about: str
    gender: Literal["male", "female", "non-binary"]
    address: str
    jobs: list[str]
    relations: list[str]
    stories: list[str]
    avoid: list[str]
    caregiver_id: str
    timezone: str


class IUser(TypedDict, total=False):
    user_id: str
    avatar_url: str
    is_premium: bool
    email: str
    name: str
    user_info: dict[str, Any]
    personality_id: str
    personality: IPersonality
    language: ILanguage
    language_code: str
    device: IDevice
    device_id: str | None
    patient_id: str
    patient: IPatient


class IPatientPhotoContext(TypedDict):
    mimeType: str
    data: str


class IJob(TypedDict, total=False):
    job_id: str
    patient_id: str
    type: CareActivityType
    title: str
    instructions: str
    cron: str
    enabled: bool
