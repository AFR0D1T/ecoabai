from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..deps import current_user, optional_user, require_admin
from ..errors import ApiError
from ..models import Event, EventParticipant, User
from ..schemas import (
    AttendanceIn, EventCategory, EventIn, EventOut, EventPatchIn, EventStatus, MyParticipationOut,
    ParticipantOut, ParticipantWithProfileOut, ProfileOut,
)
from ..services.gamification import after_points_changed, award_points, notify, revoke_points
from ..services.texts import tr

router = APIRouter(tags=["events"])
ACTIVE = ("registered", "attended")


def is_past(e: Event) -> bool:
    return e.status == "finished" or (e.ends_at or e.starts_at) < utcnow()


def counts_for(db: Session, ids: list[str]) -> dict[str, int]:
    if not ids:
        return {}
    rows = db.execute(
        select(EventParticipant.event_id, func.count())
        .where(EventParticipant.event_id.in_(ids), EventParticipant.status.in_(ACTIVE))
        .group_by(EventParticipant.event_id)
    ).all()
    return {eid: int(c) for eid, c in rows}


def to_out(e: Event, count: int) -> EventOut:
    out = EventOut.model_validate(e)
    out.participants_count = count
    return out


def one_out(db: Session, e: Event) -> EventOut:
    return to_out(e, counts_for(db, [e.id]).get(e.id, 0))


def get_event_or_404(db: Session, event_id: str) -> Event:
    e = db.get(Event, event_id)
    if not e:
        raise ApiError(404, "not_found")
    return e


@router.get("/events", response_model=list[EventOut])
def list_events(
    scope: Literal["upcoming", "past", "all"] = "all",
    category: EventCategory | Literal["all"] = "all",
    statuses: list[EventStatus] | None = Query(default=None, alias="status"),
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> list[EventOut]:
    is_admin = bool(user and user.role == "admin")
    if not statuses and not is_admin:
        statuses = ["published", "finished"]
    q = select(Event)
    if statuses:
        q = q.where(Event.status.in_(statuses))
    if not is_admin:
        q = q.where(Event.status != "draft")
    if category != "all":
        q = q.where(Event.category == category)
    events = list(db.scalars(q))
    if scope == "upcoming":
        events = [e for e in events if not is_past(e)]
    elif scope == "past":
        events = [e for e in events if is_past(e)]
    events.sort(key=lambda e: e.starts_at, reverse=scope == "past")
    counts = counts_for(db, [e.id for e in events])
    return [to_out(e, counts.get(e.id, 0)) for e in events]


@router.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: str, user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> EventOut:
    e = get_event_or_404(db, event_id)
    if e.status == "draft" and not (user and user.role == "admin"):
        raise ApiError(404, "not_found")
    return one_out(db, e)


@router.post("/events", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def create_event(body: EventIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> EventOut:
    e = Event(**body.model_dump(), created_by=admin.id)
    db.add(e)
    db.commit()
    return one_out(db, e)


def _notify_participants(db: Session, e: Event, title_key: str, body_key: str) -> None:
    rows = db.execute(
        select(User).join(EventParticipant, EventParticipant.user_id == User.id)
        .where(EventParticipant.event_id == e.id, EventParticipant.status == "registered")
    ).scalars()
    for u in rows:
        notify(db, u, "event_update", tr(u.locale, title_key), tr(u.locale, body_key, title=e.title), f"/events/{e.id}")


@router.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: str, body: EventPatchIn, _: User = Depends(require_admin),
                 db: Session = Depends(get_db)) -> EventOut:
    e = get_event_or_404(db, event_id)
    data = body.model_dump(exclude_unset=True)
    starts = data.get("starts_at", e.starts_at)
    ends = data.get("ends_at", e.ends_at)
    if ends and ends <= starts:
        raise ApiError(422, "validation")
    significant = e.status == "published" and any(
        k in data and data[k] != getattr(e, k) for k in ("starts_at", "lat", "lng", "address"))
    for k, v in data.items():
        setattr(e, k, v)
    if significant:
        _notify_participants(db, e, "event_updated_title", "event_updated_body")
    db.commit()
    return one_out(db, e)


@router.post("/events/{event_id}/cancel", response_model=EventOut)
def cancel_event(event_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> EventOut:
    e = get_event_or_404(db, event_id)
    if e.status != "cancelled":
        e.status = "cancelled"
        _notify_participants(db, e, "event_cancelled_title", "event_cancelled_body")
        db.commit()
    return one_out(db, e)


@router.post("/events/{event_id}/duplicate", response_model=EventOut, status_code=status.HTTP_201_CREATED)
def duplicate_event(event_id: str, admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> EventOut:
    src = get_event_or_404(db, event_id)
    start = src.starts_at
    while start < utcnow():
        start += timedelta(days=7)
    delta = start - src.starts_at
    copy = Event(
        title=f"{src.title} {tr(admin.locale, 'copy_suffix')}"[:120], description=src.description,
        category=src.category, status="draft", starts_at=start, ends_at=src.ends_at + delta if src.ends_at else None,
        lat=src.lat, lng=src.lng, address=src.address, max_participants=src.max_participants,
        cover_url=src.cover_url, points_reward=src.points_reward, created_by=admin.id,
    )
    db.add(copy)
    db.commit()
    return one_out(db, copy)


# ---------- участие ----------

@router.post("/events/{event_id}/registration", response_model=ParticipantOut)
def register_for_event(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> EventParticipant:
    # блокируем строку мероприятия (в Postgres), чтобы лимит мест не превысили параллельные запросы
    e = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if not e:
        raise ApiError(404, "not_found")
    if e.status != "published" or is_past(e):
        raise ApiError(409, "event_closed")
    rec = db.get(EventParticipant, (event_id, user.id))
    if rec and rec.status in ACTIVE:
        raise ApiError(409, "already_registered")
    if e.max_participants is not None and counts_for(db, [e.id]).get(e.id, 0) >= e.max_participants:
        raise ApiError(409, "event_full")
    if rec:
        rec.status, rec.registered_at = "registered", utcnow()
    else:
        rec = EventParticipant(event_id=event_id, user_id=user.id, status="registered")
        db.add(rec)
    db.commit()
    return rec


@router.delete("/events/{event_id}/registration", status_code=status.HTTP_204_NO_CONTENT)
def cancel_registration(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    rec = db.get(EventParticipant, (event_id, user.id))
    if not rec:
        raise ApiError(404, "not_found")
    if rec.status == "attended":
        raise ApiError(409, "event_closed")  # засчитанное участие отменить нельзя
    rec.status = "cancelled"
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me/participations/map", response_model=dict[str, str])
def my_participation_map(user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> dict[str, str]:
    if not user:
        return {}
    return {p.event_id: p.status for p in db.scalars(select(EventParticipant).where(EventParticipant.user_id == user.id))}


@router.get("/me/participations", response_model=list[MyParticipationOut])
def my_participations(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[MyParticipationOut]:
    rows = db.execute(
        select(EventParticipant, Event).join(Event, Event.id == EventParticipant.event_id)
        .where(EventParticipant.user_id == user.id, EventParticipant.status != "cancelled")
        .order_by(Event.starts_at.desc())
    ).all()
    counts = counts_for(db, [e.id for _, e in rows])
    return [MyParticipationOut(event=to_out(e, counts.get(e.id, 0)), participation=ParticipantOut.model_validate(p))
            for p, e in rows]


@router.get("/events/{event_id}/participants", response_model=list[ParticipantWithProfileOut])
def event_participants(event_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[ParticipantWithProfileOut]:
    get_event_or_404(db, event_id)
    rows = db.execute(
        select(EventParticipant, User).join(User, User.id == EventParticipant.user_id)
        .where(EventParticipant.event_id == event_id, EventParticipant.status != "cancelled")
        .order_by(User.last_name, User.first_name)
    ).all()
    return [ParticipantWithProfileOut(participant=ParticipantOut.model_validate(p), profile=ProfileOut.model_validate(u))
            for p, u in rows]


@router.put("/events/{event_id}/participants/{user_id}/attendance", response_model=ParticipantOut)
def set_attendance(event_id: str, user_id: str, body: AttendanceIn, _: User = Depends(require_admin),
                   db: Session = Depends(get_db)) -> EventParticipant:
    e = get_event_or_404(db, event_id)
    rec = db.get(EventParticipant, (event_id, user_id))
    if not rec or rec.status == "cancelled":
        raise ApiError(404, "not_found")
    if body.attended:
        rec.status = "attended"
        if award_points(db, user_id, e.points_reward, "event_attended", event_id):
            after_points_changed(db, user_id)
    else:
        rec.status = "no_show" if is_past(e) else "registered"
        revoke_points(db, user_id, "event_attended", event_id)
    db.commit()
    return rec
