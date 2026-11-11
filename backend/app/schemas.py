"""Pydantic-схемы. Выходные повторяют типы фронтенда (src/types/index.ts) один в один."""
import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, model_validator

Role = Literal["resident", "admin"]
EventCategory = Literal["cleanup", "tree_planting", "recycling", "lecture", "other"]
EventStatus = Literal["draft", "published", "cancelled", "finished"]
ParticipationStatus = Literal["registered", "attended", "no_show", "cancelled"]
ReportType = Literal["illegal_dump", "toxic_release", "overflowing_bin", "burning", "water_pollution", "other"]
ReportStatus = Literal["new", "in_review", "in_progress", "resolved", "rejected"]
NotificationKind = Literal["report_status", "event_reminder", "badge_earned", "new_report", "event_update"]
Severity = Literal[1, 2, 3]
Lang = Literal["ru", "kk"]

# Разрешены только файлы, загруженные через наш /api/uploads (никаких внешних или javascript: URL)
_UPLOAD_RE = re.compile(r"^/api/uploads/(?:[0-9a-f]{32}\.jpg|seed/[a-z0-9_-]{1,40}\.svg)$")


def _check_upload_url(v: str) -> str:
    if not _UPLOAD_RE.match(v):
        raise ValueError("invalid upload url")
    return v


UploadUrl = Annotated[str, AfterValidator(_check_upload_url)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Lat = Annotated[float, Field(ge=-90, le=90)]
Lng = Annotated[float, Field(ge=-180, le=180)]
Id = Annotated[str, StringConstraints(min_length=1, max_length=36)]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- выход ----------

class ProfileOut(Out):
    id: str
    first_name: str
    last_name: str
    email: str
    role: Role
    points: int
    avatar_url: str | None
    is_blocked: bool
    created_at: datetime
    last_active_at: datetime


class SessionOut(BaseModel):
    user: ProfileOut | None
    csrf_token: str | None


class EventOut(Out):
    id: str
    title: str
    description: str
    category: EventCategory
    status: EventStatus
    starts_at: datetime
    ends_at: datetime | None
    lat: float
    lng: float
    address: str | None
    max_participants: int | None
    cover_url: str | None
    points_reward: int
    created_by: str
    created_at: datetime
    participants_count: int = 0


class ParticipantOut(Out):
    event_id: str
    user_id: str
    status: ParticipationStatus
    registered_at: datetime


class MyParticipationOut(BaseModel):
    event: EventOut
    participation: ParticipantOut


class ParticipantWithProfileOut(BaseModel):
    participant: ParticipantOut
    profile: ProfileOut


class ReportOut(Out):
    id: str
    user_id: str
    type: ReportType
    severity: Severity
    description: str
    lat: float
    lng: float
    status: ReportStatus
    photo_urls: list[str]
    resolved_photo_url: str | None
    admin_comment: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class StatusChangeOut(Out):
    id: str
    report_id: str
    status: ReportStatus
    comment: str | None
    changed_by: str | None
    changed_at: datetime


class MyReportOut(ReportOut):
    history: list[StatusChangeOut]


class AuthorOut(Out):
    id: str
    first_name: str
    last_name: str
    email: str


class ReportDetailsOut(BaseModel):
    report: ReportOut
    author: AuthorOut | None
    history: list[StatusChangeOut]


class BadgeOut(Out):
    id: str
    code: str
    name_ru: str
    name_kk: str
    description_ru: str
    description_kk: str
    icon: str


class BadgeProgressOut(BaseModel):
    badge: BadgeOut
    earned_at: datetime | None
    current: int
    target: int


class NotificationOut(Out):
    id: str
    user_id: str
    kind: NotificationKind
    title: str
    body: str
    link: str | None
    is_read: bool
    created_at: datetime


class SettingsOut(Out):
    name_ru: str
    name_kk: str
    population: int
    center_lat: float
    center_lng: float
    default_zoom: int
    bounds: list[list[float]] | None


class LeaderProfileOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    avatar_url: str | None


class LeaderboardEntryOut(BaseModel):
    rank: int
    profile: LeaderProfileOut
    points: int


class RankOut(BaseModel):
    rank: int | None
    total: int


class UploadOut(BaseModel):
    url: str


# ---------- вход ----------

class SignInIn(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(min_length=1, max_length=128)]


class SignUpIn(BaseModel):
    first_name: Name
    last_name: Name
    email: EmailStr
    password: Annotated[str, Field(min_length=6, max_length=128)]


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: Annotated[str, Field(min_length=20, max_length=200)]
    password: Annotated[str, Field(min_length=6, max_length=128)]


class ProfileUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")  # роль/баллы/блокировку через этот эндпоинт менять нельзя
    first_name: Name | None = None
    last_name: Name | None = None
    avatar_url: UploadUrl | None = None
    locale: Lang | None = None


class EventIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    category: EventCategory
    status: Literal["draft", "published"]
    starts_at: datetime
    ends_at: datetime | None = None
    lat: Lat
    lng: Lng
    address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    max_participants: Annotated[int, Field(ge=1, le=10000)] | None = None
    cover_url: UploadUrl | None = None
    points_reward: Annotated[int, Field(ge=0, le=500)] = 20

    @model_validator(mode="after")
    def _dates(self) -> "EventIn":
        if self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class EventPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=120)] | None = None
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    category: EventCategory | None = None
    status: Literal["draft", "published", "finished"] | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    lat: Lat | None = None
    lng: Lng | None = None
    address: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] | None = None
    max_participants: Annotated[int, Field(ge=1, le=10000)] | None = None
    cover_url: UploadUrl | None = None
    points_reward: Annotated[int, Field(ge=0, le=500)] | None = None

    @model_validator(mode="after")
    def _not_null(self) -> "EventPatchIn":
        required = ("title", "description", "category", "status", "starts_at", "lat", "lng", "points_reward")
        for f in required:
            if f in self.model_fields_set and getattr(self, f) is None:
                raise ValueError(f"{f} cannot be null")
        if self.starts_at and self.ends_at and self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class AttendanceIn(BaseModel):
    attended: bool


class ReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: ReportType
    severity: Severity
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=500)]
    lat: Lat
    lng: Lng
    photo_urls: Annotated[list[UploadUrl], Field(max_length=3)] = []

    @model_validator(mode="after")
    def _photos(self) -> "ReportIn":
        if self.type in ("illegal_dump", "toxic_release") and not self.photo_urls:
            raise ValueError("photo required")
        return self


class ReportStatusIn(BaseModel):
    status: ReportStatus
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class ResolvedPhotoIn(BaseModel):
    url: UploadUrl | None


class BlockIn(BaseModel):
    blocked: bool


class RoleIn(BaseModel):
    role: Role


class SettingsPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name_ru: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    name_kk: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    population: Annotated[int, Field(ge=1, le=1_000_000)] | None = None
    center_lat: Lat | None = None
    center_lng: Lng | None = None
    default_zoom: Annotated[int, Field(ge=1, le=19)] | None = None
    bounds: Annotated[list[Annotated[list[float], Field(min_length=2, max_length=2)]], Field(min_length=2, max_length=2)] | None = None
