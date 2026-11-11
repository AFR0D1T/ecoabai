"""Баллы, значки, уведомления. Вызывается из роутеров внутри одной транзакции (commit делает вызывающий)."""
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import utcnow
from ..models import Badge, Event, EventParticipant, Notification, PointTransaction, User, UserBadge
from .texts import tr

REPORT_CONFIRMED_POINTS = 10


def notify(db: Session, user: User, kind: str, title: str, body: str, link: str | None,
           created_at: datetime | None = None) -> Notification:
    n = Notification(user_id=user.id, kind=kind, title=title[:200], body=body[:600], link=link,
                     created_at=created_at or utcnow())
    db.add(n)
    return n


def _recompute_points(db: Session, user_id: str) -> None:
    db.flush()
    total = db.scalar(select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(PointTransaction.user_id == user_id))
    user = db.get(User, user_id)
    if user:
        user.points = int(total or 0)


def award_points(db: Session, user_id: str, amount: int, reason: str, ref_id: str,
                 created_at: datetime | None = None) -> bool:
    """Идемпотентно: одна транзакция на (пользователь, причина, объект) — плюс уникальный индекс в БД."""
    exists = db.scalar(select(PointTransaction.id).where(
        PointTransaction.user_id == user_id, PointTransaction.reason == reason, PointTransaction.ref_id == ref_id))
    if exists or amount <= 0:
        return False
    db.add(PointTransaction(user_id=user_id, amount=amount, reason=reason, ref_id=ref_id,
                            created_at=created_at or utcnow()))
    _recompute_points(db, user_id)
    return True


def revoke_points(db: Session, user_id: str, reason: str, ref_id: str) -> None:
    tx = db.scalar(select(PointTransaction).where(
        PointTransaction.user_id == user_id, PointTransaction.reason == reason, PointTransaction.ref_id == ref_id))
    if tx:
        db.delete(tx)
        _recompute_points(db, user_id)


def month_start(now: datetime | None = None) -> datetime:
    now = now or utcnow()
    return datetime(now.year, now.month, 1, tzinfo=timezone.utc)


def monthly_points(db: Session) -> dict[str, int]:
    db.flush()
    rows = db.execute(
        select(PointTransaction.user_id, func.sum(PointTransaction.amount))
        .where(PointTransaction.created_at >= month_start())
        .group_by(PointTransaction.user_id)
    ).all()
    return {uid: int(total) for uid, total in rows}


def month_leader(db: Session) -> str | None:
    pts = monthly_points(db)
    best_id, best = None, 0
    for uid, v in pts.items():
        if v > best:
            best_id, best = uid, v
    return best_id


def _attended(db: Session, user_id: str, category: str | None = None) -> int:
    q = select(func.count()).select_from(EventParticipant).join(Event, Event.id == EventParticipant.event_id).where(
        EventParticipant.user_id == user_id, EventParticipant.status == "attended")
    if category:
        q = q.where(Event.category == category)
    return int(db.scalar(q) or 0)


def badge_progress(db: Session, user_id: str) -> dict[str, tuple[int, int]]:
    db.flush()
    reports = int(db.scalar(select(func.count()).select_from(PointTransaction).where(
        PointTransaction.user_id == user_id, PointTransaction.reason == "report_confirmed")) or 0)
    attended = _attended(db, user_id)
    return {
        "first_step": (min(1, reports + attended), 1),
        "sharp_eye": (min(5, reports), 5),
        "cleanup_x3": (min(3, _attended(db, user_id, "cleanup")), 3),
        "tree_planter": (min(1, _attended(db, user_id, "tree_planting")), 1),
        "sorter": (min(1, _attended(db, user_id, "recycling")), 1),
        "eco_leader": (1 if month_leader(db) == user_id else 0, 1),
    }


def check_badges(db: Session, user_id: str, notify_user: bool = True, earned_at: datetime | None = None) -> list[Badge]:
    progress = badge_progress(db, user_id)
    owned = set(db.scalars(select(UserBadge.badge_id).where(UserBadge.user_id == user_id)))
    user = db.get(User, user_id)
    earned: list[Badge] = []
    for badge in db.scalars(select(Badge)):
        cur, target = progress.get(badge.code, (0, 1))
        if cur < target or badge.id in owned:
            continue
        db.add(UserBadge(user_id=user_id, badge_id=badge.id, earned_at=earned_at or utcnow()))
        earned.append(badge)
        if notify_user and user:
            name = badge.name_kk if user.locale == "kk" else badge.name_ru
            notify(db, user, "badge_earned", tr(user.locale, "badge_title", icon=badge.icon, name=name),
                   tr(user.locale, "badge_body"), "/profile#badges", earned_at)
    return earned


def after_points_changed(db: Session, user_id: str) -> None:
    check_badges(db, user_id)
    leader = month_leader(db)
    if leader and leader != user_id:
        check_badges(db, leader)
