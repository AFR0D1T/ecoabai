import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db, utcnow
from ..deps import AuthContext, current_user, get_auth
from ..errors import ApiError
from ..models import AuthSession, PasswordResetToken, UsedRefreshToken, User
from ..schemas import (
    PasswordResetConfirmIn, PasswordResetRequestIn, ProfileOut, ProfileUpdateIn, SessionOut, SignInIn, SignUpIn,
)
from ..security import (
    clear_auth_cookies, create_access_token, hash_password, limiter, needs_rehash, random_token,
    set_auth_cookies, sha256, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
log = logging.getLogger("ecoabai.auth")

# если два запроса /refresh пришли почти одновременно (две вкладки), второй не считаем кражей
REFRESH_GRACE = timedelta(seconds=30)


def _auth_fail(code: str = "auth_required", status_code: int = 401) -> JSONResponse:
    """Ошибка с очисткой auth-cookie (иначе браузер продолжит слать мёртвые токены)."""
    r = JSONResponse({"code": code}, status_code=status_code)
    clear_auth_cookies(r)
    return r


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _revoke_all(db: Session, user_id: str) -> None:
    db.execute(update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
               .values(revoked_at=utcnow()))


def _start_session(db: Session, user: User, request: Request, response: Response) -> str:
    s = get_settings()
    refresh, csrf = random_token(), random_token(24)
    sess = AuthSession(user_id=user.id, refresh_hash=sha256(refresh), csrf_token=csrf,
                       expires_at=utcnow() + timedelta(days=s.refresh_ttl_days),
                       user_agent=(request.headers.get("user-agent") or "")[:300])
    db.add(sess)
    db.flush()
    set_auth_cookies(response, create_access_token(user.id, sess.id, csrf), refresh)
    return csrf


def _end_current_session(db: Session, request: Request) -> None:
    token = request.cookies.get(get_settings().refresh_cookie)
    if token:
        sess = db.scalar(select(AuthSession).where(AuthSession.refresh_hash == sha256(token)))
        if sess and sess.revoked_at is None:
            sess.revoked_at = utcnow()


@router.get("/session", response_model=SessionOut)
def get_session(ctx: AuthContext | None = Depends(get_auth)) -> SessionOut:
    if not ctx:
        return SessionOut(user=None, csrf_token=None)
    return SessionOut(user=ProfileOut.model_validate(ctx.user), csrf_token=ctx.session.csrf_token)


@router.post("/login", response_model=SessionOut)
def login(body: SignInIn, request: Request, response: Response, db: Session = Depends(get_db)) -> SessionOut:
    email = body.email.lower()
    limiter.hit(f"login:ip:{client_ip(request)}", 20, 300)
    limiter.hit(f"login:email:{email}", 8, 300)
    user = db.scalar(select(User).where(User.email == email))
    if not verify_password(body.password, user.password_hash if user else None) or not user:
        raise ApiError(401, "invalid_credentials")
    if user.is_blocked:
        raise ApiError(403, "user_blocked")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    _end_current_session(db, request)
    user.last_active_at = utcnow()
    csrf = _start_session(db, user, request, response)
    db.commit()
    return SessionOut(user=ProfileOut.model_validate(user), csrf_token=csrf)


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(body: SignUpIn, request: Request, response: Response, db: Session = Depends(get_db)) -> SessionOut:
    limiter.hit(f"register:ip:{client_ip(request)}", 10, 3600)
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise ApiError(409, "email_taken")
    user = User(email=email, password_hash=hash_password(body.password), first_name=body.first_name,
                last_name=body.last_name, role="resident")
    db.add(user)
    db.flush()
    csrf = _start_session(db, user, request, response)
    db.commit()
    return SessionOut(user=ProfileOut.model_validate(user), csrf_token=csrf)


@router.post("/refresh", response_model=SessionOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)) -> SessionOut | JSONResponse:
    s = get_settings()
    token = request.cookies.get(s.refresh_cookie)

    if not token:
        return _auth_fail()
    h = sha256(token)
    now = utcnow()
    sess = db.scalar(select(AuthSession).where(AuthSession.refresh_hash == h))
    if not sess:
        used = db.get(UsedRefreshToken, h)
        if used:
            prev = db.get(AuthSession, used.session_id)
            if prev and prev.revoked_at is None and now - used.used_at < REFRESH_GRACE:
                # гонка двух вкладок: выдаём только новый access, refresh-cookie у браузера уже свежий
                user = db.get(User, prev.user_id)
                if user and not user.is_blocked:
                    response.set_cookie(s.access_cookie, create_access_token(user.id, prev.id, prev.csrf_token),
                                        max_age=s.access_ttl_minutes * 60, path="/", httponly=True,
                                        secure=s.cookie_secure, samesite=s.cookie_samesite)
                    return SessionOut(user=ProfileOut.model_validate(user), csrf_token=prev.csrf_token)
            if prev:
                log.warning("refresh token reuse detected, revoking sessions of user %s", prev.user_id)
                _revoke_all(db, prev.user_id)
                db.commit()
        return _auth_fail()
    if sess.revoked_at is not None or sess.expires_at < now:
        return _auth_fail()
    user = db.get(User, sess.user_id)
    if not user or user.is_blocked:
        sess.revoked_at = now
        db.commit()
        return _auth_fail("user_blocked", 403) if user else _auth_fail()

    new_refresh = random_token()
    db.add(UsedRefreshToken(refresh_hash=h, session_id=sess.id, used_at=now))
    sess.refresh_hash = sha256(new_refresh)
    sess.expires_at = now + timedelta(days=s.refresh_ttl_days)
    set_auth_cookies(response, create_access_token(user.id, sess.id, sess.csrf_token), new_refresh)
    db.commit()
    return SessionOut(user=ProfileOut.model_validate(user), csrf_token=sess.csrf_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    _end_current_session(db, request)
    db.commit()
    clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post("/password-reset/request", status_code=status.HTTP_204_NO_CONTENT)
def request_reset(body: PasswordResetRequestIn, request: Request, db: Session = Depends(get_db)) -> Response:
    email = body.email.lower()
    limiter.hit(f"reset:ip:{client_ip(request)}", 5, 3600)
    limiter.hit(f"reset:email:{email}", 3, 3600)
    user = db.scalar(select(User).where(User.email == email))
    if user and not user.is_blocked:
        token = random_token()
        db.add(PasswordResetToken(token_hash=sha256(token), user_id=user.id,
                                  expires_at=utcnow() + timedelta(minutes=get_settings().reset_ttl_minutes)))
        db.commit()
        # TODO: отправка письма через SMTP/почтовый сервис. Пока ссылка пишется в лог сервера.
        log.warning("Password reset link for %s: %s/reset-password?token=%s", email, get_settings().frontend_url, token)
    # одинаковый ответ, есть такой email или нет (без перечисления аккаунтов)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/password-reset/confirm", status_code=status.HTTP_204_NO_CONTENT)
def confirm_reset(body: PasswordResetConfirmIn, request: Request, db: Session = Depends(get_db)) -> Response:
    limiter.hit(f"reset-confirm:ip:{client_ip(request)}", 10, 3600)
    rec = db.get(PasswordResetToken, sha256(body.token))
    if not rec or rec.used_at is not None or rec.expires_at < utcnow():
        raise ApiError(400, "invalid_token")
    user = db.get(User, rec.user_id)
    if not user:
        raise ApiError(400, "invalid_token")
    user.password_hash = hash_password(body.password)
    rec.used_at = utcnow()
    _revoke_all(db, user.id)  # выйти на всех устройствах
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me", response_model=ProfileOut)
def update_me(body: ProfileUpdateIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    data = body.model_dump(exclude_unset=True)
    for f in ("first_name", "last_name", "locale"):
        if f in data and data[f] is None:
            raise ApiError(422, "validation")
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    return user
