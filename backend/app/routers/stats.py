from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..deps import require_admin
from ..models import Event, EventParticipant, Report, User, VillageSettings
from ..services.gamification import month_start

router = APIRouter(tags=["stats"])
ACTIVE = ("new", "in_review", "in_progress")
TYPES = ("illegal_dump", "toxic_release", "overflowing_bin", "burning", "water_pollution", "other")


def _months_back(n: int) -> list[datetime]:
    cur = month_start()
    out = []
    for _ in range(n):
        out.append(cur)
        prev = cur - timedelta(days=1)
        cur = datetime(prev.year, prev.month, 1, tzinfo=timezone.utc)
    return list(reversed(out))


def _same_month(d: datetime | None, m: datetime) -> bool:
    return d is not None and d.year == m.year and d.month == m.month


@router.get("/stats/dashboard")
def dashboard(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    now = utcnow()
    m_start = month_start()
    settings = db.get(VillageSettings, 1)
    users = list(db.scalars(select(User)))
    reports = list(db.scalars(select(Report)))
    events = list(db.scalars(select(Event)))
    parts = list(db.scalars(select(EventParticipant)))

    resolved_all = [r for r in reports if r.resolved_at]
    avg = (sum((r.resolved_at - r.created_at).total_seconds() for r in resolved_all) / len(resolved_all) / 3600
           if resolved_all else None)
    finished_ids = {e.id for e in events if e.status == "finished"}
    finished_parts = [p for p in parts if p.event_id in finished_ids and p.status != "cancelled"]

    week0 = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    weeks = []
    for i in range(11, -1, -1):
        ws = week0 - timedelta(weeks=i)
        we = ws + timedelta(weeks=1)
        weeks.append({"week": ws.strftime("%d.%m"), "count": sum(1 for u in users if ws <= u.created_at < we)})

    months = _months_back(6)
    by_month = [{"month": m.strftime("%Y-%m"),
                 "created": sum(1 for r in reports if _same_month(r.created_at, m)),
                 "resolved": sum(1 for r in reports if _same_month(r.resolved_at, m))} for m in months]
    participation = []
    for m in months:
        ids = {e.id for e in events if _same_month(e.starts_at, m)}
        ps = [p for p in parts if p.event_id in ids and p.status != "cancelled"]
        participation.append({"month": m.strftime("%Y-%m"), "registered": len(ps),
                              "attended": sum(1 for p in ps if p.status == "attended")})

    return {
        "population": settings.population if settings else 0,
        "registered": sum(1 for u in users if u.role == "resident"),
        "active_7d": sum(1 for u in users if now - u.last_active_at <= timedelta(days=7)),
        "active_30d": sum(1 for u in users if now - u.last_active_at <= timedelta(days=30)),
        "reports_new": sum(1 for r in reports if r.status == "new"),
        "reports_in_progress": sum(1 for r in reports if r.status in ("in_progress", "in_review")),
        "reports_resolved_month": sum(1 for r in reports if r.resolved_at and r.resolved_at >= m_start),
        "avg_resolution_hours": avg,
        "events_month": sum(1 for e in events if _same_month(e.starts_at, m_start) and e.status != "draft"),
        "participants_total": sum(1 for p in parts if p.status in ("registered", "attended")),
        "attendance_rate": (sum(1 for p in finished_parts if p.status == "attended") / len(finished_parts)
                            if finished_parts else None),
        "registrations_by_week": weeks,
        "reports_by_type": [{"type": t, "count": sum(1 for r in reports if r.type == t)} for t in TYPES],
        "reports_by_month": by_month,
        "participation_by_month": participation,
        "hotspots": [{"lat": r.lat, "lng": r.lng, "weight": r.severity, "status": r.status}
                     for r in reports if r.status != "rejected"],
    }
