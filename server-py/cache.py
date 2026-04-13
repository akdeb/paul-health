"""Redis-backed cache helpers for Paul server session context."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

import redis
from loguru import logger

from app_types import IConversation, IUser

USER_CONTEXT_TTL_SECONDS = int(os.getenv("USER_CONTEXT_TTL_SECONDS", "604800"))
CHAT_HISTORY_TTL_SECONDS = int(os.getenv("CHAT_HISTORY_TTL_SECONDS", "3600"))
MAX_CHAT_HISTORY_ITEMS = int(os.getenv("MAX_CHAT_HISTORY_ITEMS", "30"))


def _get_redis_url() -> str | None:
    return os.getenv("REDIS_URL")


def _get_redis_kwargs() -> dict[str, Any] | None:
    host = os.getenv("REDISHOST") or os.getenv("REDIS_HOST")
    port = os.getenv("REDISPORT") or os.getenv("REDIS_PORT")
    password = os.getenv("REDISPASSWORD") or os.getenv("REDIS_PASSWORD")
    username = os.getenv("REDISUSER") or os.getenv("REDIS_USERNAME") or "default"

    if not host or not port:
        return None

    return {
        "host": host,
        "port": int(port),
        "username": username,
        "password": password,
        "decode_responses": True,
    }


@lru_cache(maxsize=1)
def get_redis_client() -> redis.Redis | None:
    try:
        redis_url = _get_redis_url()
        if redis_url:
            client = redis.Redis.from_url(redis_url, decode_responses=True)
        else:
            redis_kwargs = _get_redis_kwargs()
            if not redis_kwargs:
                logger.info("Redis not configured; cache disabled")
                return None
            client = redis.Redis(**redis_kwargs)

        client.ping()
        logger.info("Redis cache connected")
        return client
    except Exception as exc:
        logger.warning("Redis unavailable; cache disabled: {}", exc)
        return None


def _json_get(key: str) -> Any | None:
    client = get_redis_client()
    if client is None:
        return None
    try:
        value = client.get(key)
        if not value:
            return None
        return json.loads(value)
    except Exception as exc:
        logger.warning("Redis get failed for {}: {}", key, exc)
        return None


def _json_set(key: str, value: Any, ttl_seconds: int) -> None:
    client = get_redis_client()
    if client is None:
        return
    try:
        client.setex(key, ttl_seconds, json.dumps(value))
    except Exception as exc:
        logger.warning("Redis set failed for {}: {}", key, exc)


def _context_key(email: str) -> str:
    return f"user_email:{email}:context"


def _chat_history_key(user_id: str) -> str:
    return f"user:{user_id}:chat_history"


def get_cached_user_context(email: str) -> dict[str, Any] | None:
    return _json_get(_context_key(email))


def set_cached_user_context(
    email: str,
    *,
    user: IUser,
) -> None:
    _json_set(
        _context_key(email),
        {
            "user": user,
        },
        USER_CONTEXT_TTL_SECONDS,
    )


def invalidate_cached_user_context(email: str) -> None:
    client = get_redis_client()
    if client is None:
        return
    try:
        client.delete(_context_key(email))
    except Exception as exc:
        logger.warning("Redis delete failed for {}: {}", email, exc)


def get_cached_chat_history(user_id: str) -> list[IConversation] | None:
    cached = _json_get(_chat_history_key(user_id))
    if cached is None:
        return None
    return cached


def set_cached_chat_history(user_id: str, history: list[IConversation]) -> None:
    _json_set(
        _chat_history_key(user_id),
        history[:MAX_CHAT_HISTORY_ITEMS],
        CHAT_HISTORY_TTL_SECONDS,
    )


def append_cached_chat_history(user_id: str, entries: list[IConversation]) -> None:
    if not entries:
        return

    existing = get_cached_chat_history(user_id) or []
    updated = entries + existing
    set_cached_chat_history(user_id, updated[:MAX_CHAT_HISTORY_ITEMS])
