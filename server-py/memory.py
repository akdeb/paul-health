"""Long-term patient memory via Mem0 (self-hosted on Supabase pgvector + Gemini).

Mem0 OSS runs entirely in-process: facts are extracted with Gemini and stored as
vectors in your own Supabase Postgres (pgvector). No Mem0 cloud, no extra service.

Write path: the Live model calls the `remember` tool when it decides a fact is
worth keeping; the handler calls `remember_fact`, which runs Mem0's add/update/
delete reconciliation (Gemini calls) -- so run it OFF the realtime audio path,
inside a thread. No per-turn extraction; writes happen only on tool calls.
Read path: `recall_memories_block` is a plain DB fetch (no LLM), cheap enough to
run at session/prompt-build time.

Every function degrades to a no-op (never raises) when memory is unconfigured or
mem0 is not installed, so the voice pipeline keeps working regardless.
"""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlparse

from loguru import logger

_memory: Any = None
_init_attempted = False


def _resolve_pg_params() -> dict[str, Any] | None:
    """Build Postgres connection params for pgvector.

    Preferred: a full `SUPABASE_DB_URL`. Otherwise derive the direct DB host from
    the existing `SUPABASE_URL` + a `SUPABASE_DB_PASSWORD` (the database password,
    NOT the anon/service API key -- those can't open a Postgres connection).
    """
    db_url = os.getenv("SUPABASE_DB_URL")
    if db_url:
        p = urlparse(db_url)
        return {
            "dbname": p.path.lstrip("/") or "postgres",
            "user": p.username or "postgres",
            "password": p.password,
            "host": p.hostname,
            "port": p.port or 5432,
        }

    supabase_url = os.getenv("SUPABASE_URL")
    db_password = os.getenv("SUPABASE_DB_PASSWORD")
    if supabase_url and db_password:
        ref = (urlparse(supabase_url).hostname or "").split(".")[0]
        if ref:
            return {
                "dbname": "postgres",
                "user": "postgres",
                "password": db_password,
                "host": f"db.{ref}.supabase.co",
                "port": 5432,
            }

    return None


def _build_memory() -> Any:
    pg = _resolve_pg_params()
    if not pg:
        logger.warning(
            "Patient memory disabled: set SUPABASE_DB_PASSWORD (with SUPABASE_URL) "
            "or a full SUPABASE_DB_URL."
        )
        return None

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("No Gemini API key; patient memory disabled.")
        return None
    # mem0's gemini provider reads GOOGLE_API_KEY from the environment.
    os.environ.setdefault("GOOGLE_API_KEY", api_key)

    try:
        from mem0 import Memory
    except ImportError:
        logger.warning("mem0ai not installed; patient memory disabled.")
        return None

    config = {
        "llm": {
            "provider": "gemini",
            "config": {
                "model": os.getenv("MEM0_LLM_MODEL", "gemini-2.5-flash"),
                "temperature": 0.0,
            },
        },
        "embedder": {
            "provider": "gemini",
            # text-embedding-004 -> 768 dims; must match the pgvector column width.
            "config": {"model": "models/text-embedding-004"},
        },
        "vector_store": {
            "provider": "pgvector",
            "config": {
                "collection_name": os.getenv("MEM0_COLLECTION", "patient_memories"),
                "embedding_model_dims": 768,
                "hnsw": True,
                **pg,
            },
        },
    }

    try:
        memory = Memory.from_config(config)
        logger.info("Patient memory (Mem0 + pgvector) initialized.")
        return memory
    except Exception as exc:
        logger.warning("Failed to init Mem0 memory: {}", exc)
        return None


def get_memory() -> Any:
    global _memory, _init_attempted
    if not _init_attempted:
        _init_attempted = True
        _memory = _build_memory()
    return _memory


def _patient_id_from_user(user: dict[str, Any]) -> str | None:
    patient = user.get("patient") or {}
    pid = patient.get("patient_id") or user.get("patient_id")
    return str(pid) if pid else None


def memory_enabled() -> bool:
    return get_memory() is not None


def memory_tool_instructions() -> str:
    """System-prompt guidance telling Paul when to call the `remember` tool."""
    if not memory_enabled():
        return ""
    return (
        "PATIENT MEMORY:\n"
        "You have a long-term memory for this patient. When the patient shares something "
        "durable worth recalling in future chats -- their preferred name, important people, "
        "interests, routines, preferences, health notes, or topics to avoid -- call the "
        "`remember` tool with one concise fact in the third person "
        "(e.g. \"Patient's daughter Alysha visits on Sundays\"). "
        "Do not call it for small talk or passing details, and do not tell the patient you are saving it."
    )


def remember_fact(user: dict[str, Any], fact: str) -> None:
    """Store one fact the model chose to remember (via the `remember` tool).

    Mem0 still reconciles add/update/delete against existing memories. Runs Gemini
    calls -- call from a thread, never inline in the audio stream. No-ops on failure.
    """
    mem = get_memory()
    if mem is None:
        return

    patient_id = _patient_id_from_user(user)
    fact = (fact or "").strip()
    if not patient_id or not fact:
        return

    try:
        mem.add([{"role": "user", "content": fact}], user_id=patient_id)
    except Exception as exc:
        logger.warning("Mem0 add failed for patient {}: {}", patient_id, exc)


def recall_memories_block(user: dict[str, Any]) -> str:
    """Render all stored memories for this patient as a system-prompt block.

    Plain DB fetch (no LLM). Returns "" when memory is disabled, empty, or errors.
    """
    mem = get_memory()
    if mem is None:
        return ""

    patient_id = _patient_id_from_user(user)
    if not patient_id:
        return ""

    try:
        result = mem.get_all(user_id=patient_id)
    except Exception as exc:
        logger.warning("Mem0 get_all failed for patient {}: {}", patient_id, exc)
        return ""

    items = result.get("results", result) if isinstance(result, dict) else result
    memories = [
        item.get("memory")
        for item in (items or [])
        if isinstance(item, dict) and item.get("memory")
    ]
    if not memories:
        return ""

    lines = "\n".join(f"- {m}" for m in memories)
    return (
        "WHAT YOU REMEMBER ABOUT THE PATIENT (LONG-TERM MEMORY):\n"
        "Durable facts gathered from past conversations and onboarding. Use them "
        "naturally in conversation; do not recite them as a list or claim perfect recall.\n"
        f"{lines}"
    )
