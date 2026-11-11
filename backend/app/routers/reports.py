from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db, utcnow
from ..deps import current_user, optional_user, require_admin
from ..errors import ApiError
from ..models import Report, ReportStatusChange, User
from ..schemas import (
    AuthorOut, MyReportOut, ReportDetailsOut, ReportIn, ReportOut, ReportStatus, ReportStatusIn, ReportType,
    ResolvedPhotoIn, StatusChangeOut,
)
from ..security import limiter
from ..services.gamification import REPORT_CONFIRMED_POINTS, after_points_changed, award_points, notify
from ..services.texts import tr

router = APIRouter(tags=["reports"])


def public_out(r: Report, viewer: User | None) -> ReportOut:
    """Чужим (не автору и не админу) не раскрываем, кто автор обращения."""
    out = ReportOut.model_validate(r)
    if not viewer or (viewer.role != "admin" and viewer.id != r.user_id):
        out.user_id = ""
    return out


def history_of(db: Session, report_id: str) -> list[StatusChangeOut]:
    rows = db.scalars(select(ReportStatusChange).where(ReportStatusChange.report_id == report_id)
                      .order_by(ReportStatusChange.changed_at))
    return [StatusChangeOut.model_validate(h) for h in rows]


@router.get("/reports", response_model=list[ReportOut])
def list_reports(
    statuses: list[ReportStatus] | None = Query(default=None, alias="status"),
    type: ReportType | Literal["all"] = "all",
    severity: Literal["1", "2", "3", "all"] = "all",
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    sort: Literal["date_desc", "date_asc", "severity_desc"] = "date_desc",
    user: User | None = Depends(optional_user),
    db: Session = Depends(get_db),
) -> list[ReportOut]:
    q = select(Report)
    if not (user and user.role == "admin"):
        q = q.where(Report.status != "rejected")
    if statuses:
        q = q.where(Report.status.in_(statuses))
    if type != "all":
        q = q.where(Report.type == type)
    if severity != "all":
        q = q.where(Report.severity == int(severity))
    if date_from:
        q = q.where(Report.created_at >= date_from)
    if date_to:
        q = q.where(Report.created_at <= date_to)
    if sort == "severity_desc":
        q = q.order_by(Report.severity.desc(), Report.created_at.desc())
    elif sort == "date_asc":
        q = q.order_by(Report.created_at.asc())
    else:
        q = q.order_by(Report.created_at.desc())
    return [public_out(r, user) for r in db.scalars(q)]


@router.get("/reports/new-count", response_model=int)
def new_count(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> int:
    return int(db.scalar(select(func.count()).select_from(Report).where(Report.status == "new")) or 0)


@router.get("/me/reports", response_model=list[MyReportOut])
def my_reports(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[MyReportOut]:
    rows = db.scalars(select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc()))
    return [MyReportOut(**ReportOut.model_validate(r).model_dump(), history=history_of(db, r.id)) for r in rows]


@router.get("/reports/{report_id}", response_model=ReportDetailsOut)
def get_report(report_id: str, user: User | None = Depends(optional_user), db: Session = Depends(get_db)) -> ReportDetailsOut:
    r = db.get(Report, report_id)
    privileged = bool(user and (user.role == "admin" or user.id == (r.user_id if r else None)))
    if not r or (r.status == "rejected" and not privileged):
        raise ApiError(404, "not_found")
    author = db.get(User, r.user_id) if privileged else None
    return ReportDetailsOut(
        report=public_out(r, user),
        author=AuthorOut.model_validate(author) if author else None,
        history=history_of(db, r.id),
    )


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def create_report(body: ReportIn, request: Request, user: User = Depends(current_user),
                  db: Session = Depends(get_db)) -> ReportOut:
    limiter.hit(f"report:user:{user.id}", 20, 3600)
    now = utcnow()
    r = Report(user_id=user.id, type=body.type, severity=body.severity, description=body.description,
               lat=body.lat, lng=body.lng, status="new", photo_urls=body.photo_urls,
               created_at=now, updated_at=now)
    db.add(r)
    db.flush()
    db.add(ReportStatusChange(report_id=r.id, status="new", changed_by=user.id, changed_at=now))
    for admin in db.scalars(select(User).where(User.role == "admin", User.is_blocked.is_(False))):
        notify(db, admin, "new_report", tr(admin.locale, "new_report_title"), tr(admin.locale, f"type.{r.type}"),
               f"/admin/reports?id={r.id}")
    db.commit()
    return public_out(r, user)


@router.post("/reports/{report_id}/status", response_model=ReportOut)
def set_status(report_id: str, body: ReportStatusIn, admin: User = Depends(require_admin),
               db: Session = Depends(get_db)) -> ReportOut:
    r = db.get(Report, report_id)
    if not r:
        raise ApiError(404, "not_found")
    now = utcnow()
    comment = body.comment or None
    changed = r.status != body.status
    if not changed and not comment:
        return public_out(r, admin)
    r.status = body.status
    if comment:
        r.admin_comment = comment
    r.updated_at = now
    r.resolved_at = now if body.status == "resolved" else None
    db.add(ReportStatusChange(report_id=r.id, status=body.status, comment=comment, changed_by=admin.id, changed_at=now))
    if body.status in ("in_progress", "resolved") and award_points(
            db, r.user_id, REPORT_CONFIRMED_POINTS, "report_confirmed", r.id):
        after_points_changed(db, r.user_id)
    author = db.get(User, r.user_id)
    if author:
        body_text = tr(author.locale, "report_status_body", status=tr(author.locale, f"status.{body.status}"))
        if comment:
            body_text += f" — {comment}"
        notify(db, author, "report_status", tr(author.locale, "report_status_title"), body_text, f"/profile#report-{r.id}")
    db.commit()
    return public_out(r, admin)


@router.put("/reports/{report_id}/resolved-photo", response_model=ReportOut)
def set_resolved_photo(report_id: str, body: ResolvedPhotoIn, admin: User = Depends(require_admin),
                       db: Session = Depends(get_db)) -> ReportOut:
    r = db.get(Report, report_id)
    if not r:
        raise ApiError(404, "not_found")
    r.resolved_photo_url = body.url
    r.updated_at = utcnow()
    db.commit()
    return public_out(r, admin)
