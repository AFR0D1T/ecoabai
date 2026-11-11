"""Пользователи (админ), рейтинг, значки, уведомления."""
from typing import Literal

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..deps import current_user, optional_user, require_admin
from ..errors import ApiError
from ..models import AuthSession, Badge, Notification, User, UserBadge
from ..schemas import (
    BadgeOut, BadgeProgressOut, BlockIn, LeaderboardEntryOut, LeaderProfileOut, NotificationOut, ProfileOut, RankOut,
    RoleIn,
)
from ..services.gamification import badge_progress, monthly_points

router = APIRouter(tags=["community"])


# ---------- пользователи (только админ) ----------

@router.get("/admin/users", response_model=list[ProfileOut])
def list_users(search: str = "", _: User = Depends(require_admin),
               db: Session = Depends(get_db)) -> list[User]:
    q = select(User).order_by(User.created_at.desc())
    term = search.strip()[:100]
    if term:
        like = f"%{term.lower()}%"
        q = q.where(or_(func.lower(User.first_name).like(like), func.lower(User.last_name).like(like),
                        func.lower(User.email).like(like)))
    return list(db.scalars(q))


def _target(db: Session, admin: User, user_id: str) -> User:
    if admin.id == user_id:
        raise ApiError(403, "forbidden")  # нельзя заблокировать или разжаловать себя
    u = db.get(User, user_id)
    if not u:
        raise ApiError(404, "not_found")
    return u


@router.put("/admin/users/{user_id}/blocked", response_model=ProfileOut)
def set_blocked(user_id: str, body: BlockIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    u = _target(db, admin, user_id)
    u.is_blocked = body.blocked
    if body.blocked:  # мгновенный выход со всех устройств
        db.execute(update(AuthSession).where(AuthSession.user_id == u.id, AuthSession.revoked_at.is_(None))
                   .values(revoked_at=utcnow()))
    db.commit()
    return u


@router.put("/admin/users/{user_id}/role", response_model=ProfileOut)
def set_role(user_id: str, body: RoleIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    u = _target(db, admin, user_id)
    u.role = body.role
    db.commit()
    return u


# ---------- рейтинг ----------

@router.get("/leaderboard", response_model=list[LeaderboardEntryOut])
def leaderboard(period: Literal["month", "all"] = "month", limit: int = 50,
                db: Session = Depends(get_db)) -> list[LeaderboardEntryOut]:
    limit = max(1, min(limit, 100))
    residents = list(db.scalars(select(User).where(User.role == "resident", User.is_blocked.is_(False))))
    month = monthly_points(db) if period == "month" else None
    rows = [(u, month.get(u.id, 0) if month is not None else u.points) for u in residents]
    rows = sorted([r for r in rows if r[1] > 0], key=lambda r: (-r[1], r[0].last_name))
    out: list[LeaderboardEntryOut] = []
    rank, prev = 0, None
    for i, (u, pts) in enumerate(rows[:limit]):
        if pts != prev:
            rank = i + 1
        prev = pts
        # публично — только имя и первая буква фамилии
        out.append(LeaderboardEntryOut(rank=rank, points=pts, profile=LeaderProfileOut(
            id=u.id, first_name=u.first_name, last_name=u.last_name[:1],
            avatar_url=u.avatar_url)))
    return out


@router.get("/users/{user_id}/rank", response_model=RankOut)
def user_rank(user_id: str, viewer: User = Depends(current_user), db: Session = Depends(get_db)) -> RankOut:
    if viewer.id != user_id and viewer.role != "admin":
        raise ApiError(403, "forbidden")
    base = select(func.count()).select_from(User).where(User.role == "resident", User.is_blocked.is_(False))
    total = int(db.scalar(base) or 0)
    u = db.get(User, user_id)
    if not u or u.role != "resident" or u.is_blocked:
        return RankOut(rank=None, total=total)
    higher = int(db.scalar(base.where(User.points > u.points)) or 0)
    return RankOut(rank=higher + 1, total=total)


# ---------- значки ----------

@router.get("/badges", response_model=list[BadgeOut])
def list_badges(db: Session = Depends(get_db)) -> list[Badge]:
    return list(db.scalars(select(Badge)))


@router.get("/me/badges", response_model=list[BadgeProgressOut])
def my_badges(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[BadgeProgressOut]:
    progress = badge_progress(db, user.id)
    owned = {ub.badge_id: ub.earned_at for ub in db.scalars(select(UserBadge).where(UserBadge.user_id == user.id))}
    out = []
    for b in db.scalars(select(Badge)):
        cur, target = progress.get(b.code, (0, 1))
        earned = owned.get(b.id)
        out.append(BadgeProgressOut(badge=BadgeOut.model_validate(b), earned_at=earned,
                                    current=target if earned else cur, target=target))
    return out


# ---------- уведомления ----------

@router.get("/me/notifications", response_model=list[NotificationOut])
def my_notifications(user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> list[Notification]:
    if not user:
        return []
    return list(db.scalars(select(Notification).where(Notification.user_id == user.id)
                           .order_by(Notification.created_at.desc()).limit(100)))


@router.post("/me/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    db.execute(update(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
               .values(is_read=True))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
