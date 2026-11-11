from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db, utcnow
from .errors import ApiError
from .models import AuthSession, User
from .security import csrf_matches, decode_access_token

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@dataclass
class AuthContext:
    user: User
    session: AuthSession


def get_auth(request: Request, db: Session = Depends(get_db)) -> AuthContext | None:
    """Пользователь из access-cookie или None (гость).

    * просроченный токен → 401 token_expired (клиент вызовет /auth/refresh и повторит запрос);
    * битый токен / отозванная сессия → гость (защищённые эндпоинты ответят auth_required);
    * заблокированный пользователь → 403 user_blocked;
    * для изменяющих запросов обязателен заголовок X-CSRF-Token.
    """
    token = request.cookies.get(get_settings().access_cookie)
    if not token:
        return None
    try:
        data = decode_access_token(token)
    except ApiError as e:
        if e.code == "token_expired":
            raise
        return None
    sess = db.get(AuthSession, data["sid"])
    now = utcnow()
    if not sess or sess.revoked_at is not None or sess.user_id != data["sub"] or sess.expires_at < now:
        return None
    user = db.get(User, data["sub"])
    if not user:
        return None
    if user.is_blocked:
        raise ApiError(403, "user_blocked")
    if request.method not in SAFE_METHODS and not csrf_matches(request.headers.get("x-csrf-token"), data["csrf"]):
        raise ApiError(403, "csrf_failed")
    if now - user.last_active_at > timedelta(minutes=5):
        user.last_active_at = now
        db.commit()
    return AuthContext(user=user, session=sess)


def optional_user(ctx: AuthContext | None = Depends(get_auth)) -> User | None:
    return ctx.user if ctx else None


def current_user(ctx: AuthContext | None = Depends(get_auth)) -> User:
    if not ctx:
        raise ApiError(401, "auth_required")
    return ctx.user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise ApiError(403, "forbidden")
    return user
