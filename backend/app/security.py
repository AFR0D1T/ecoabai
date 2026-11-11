"""
Безопасность:
* пароли — Argon2id;
* access-токен — JWT (HS256, 15 мин) в httpOnly cookie; refresh-токен — случайная строка в httpOnly cookie
  с узким path, в БД хранится только SHA-256 хэш; ротация при каждом обновлении и обнаружение повторного
  использования (кража токена → отзыв всех сессий пользователя);
* JS-код страницы токены не видит вообще. Для защиты от CSRF клиент получает csrf-токен в теле ответа
  (/auth/session, /auth/login) и шлёт его в заголовке X-CSRF-Token; сервер сверяет его с claim в access-токене.
"""
import hashlib
import hmac
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Response

from .config import get_settings
from .errors import ApiError

_ph = PasswordHasher()  # argon2id, параметры по умолчанию (RFC 9106 low-memory)
# хэш-заглушка: проверяем пароль даже для несуществующего email, чтобы время ответа не выдавало наличие аккаунта
_DUMMY_HASH = _ph.hash("dummy-password-for-timing")

JWT_ALG = "HS256"
AUDIENCE = "ecoabai"


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _ph.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _ph.check_needs_rehash(password_hash)


def random_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create_access_token(user_id: str, session_id: str, csrf: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "sid": session_id,
        "csrf": sha256(csrf),  # в токене только хэш csrf
        "type": "access",
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=s.access_ttl_minutes),
    }
    return jwt.encode(payload, s.secret_key, algorithm=JWT_ALG)


def decode_access_token(token: str) -> dict:
    s = get_settings()
    try:
        data = jwt.decode(
            token, s.secret_key, algorithms=[JWT_ALG], audience=AUDIENCE,
            options={"require": ["exp", "sub", "sid", "csrf", "type"]},
        )
    except jwt.ExpiredSignatureError as e:
        raise ApiError(401, "token_expired") from e
    except jwt.PyJWTError as e:
        raise ApiError(401, "auth_required") from e
    if data.get("type") != "access":
        raise ApiError(401, "auth_required")
    return data


def csrf_matches(header_value: str | None, claim_hash: str) -> bool:
    if not header_value:
        return False
    return hmac.compare_digest(sha256(header_value), claim_hash)


# ---------- cookies ----------

def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.access_cookie, access, max_age=s.access_ttl_minutes * 60, path="/",
        httponly=True, secure=s.cookie_secure, samesite=s.cookie_samesite,
    )
    response.set_cookie(
        s.refresh_cookie, refresh, max_age=s.refresh_ttl_days * 86400, path="/api/auth",
        httponly=True, secure=s.cookie_secure, samesite="strict",
    )


def clear_auth_cookies(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(s.access_cookie, path="/", secure=s.cookie_secure, httponly=True, samesite=s.cookie_samesite)
    response.delete_cookie(s.refresh_cookie, path="/api/auth", secure=s.cookie_secure, httponly=True, samesite="strict")


# ---------- простой ограничитель частоты (in-memory, на один процесс) ----------

class RateLimiter:
    """Скользящее окно. Для нескольких инстансов замените на Redis."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window_s: int) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                retry = int(window_s - (now - q[0])) + 1
                raise ApiError(429, "rate_limited", headers={"Retry-After": str(retry)})
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()
