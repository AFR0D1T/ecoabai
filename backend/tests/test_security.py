import io

from PIL import Image

from app.routers import auth as auth_router
from tests.conftest import Api


def _upcoming_event(api: Api) -> dict:
    return api.get("/api/events", params={"scope": "upcoming"}).json()[0]


# ---------- токены и cookie ----------

def test_login_sets_httponly_cookies_and_no_token_in_body(guest: Api) -> None:
    r = guest.login("resident@test.kz")
    assert r.status_code == 200
    body = r.text
    assert "eyJ" not in body  # JWT не попадает в тело ответа
    cookies = r.headers.get_list("set-cookie")
    assert any(c.startswith("eco_at=") and "HttpOnly" in c and "SameSite=lax" in c for c in cookies)
    assert any(c.startswith("eco_rt=") and "HttpOnly" in c and "Path=/api/auth" in c and "SameSite=strict" in c
               for c in cookies)
    assert set(r.json().keys()) == {"user", "csrf_token"}
    assert "password_hash" not in body


def test_wrong_password_and_rate_limit(guest: Api) -> None:
    assert guest.login("resident@test.kz", "wrong").json()["code"] == "invalid_credentials"
    assert guest.login("nobody@test.kz", "wrong").json()["code"] == "invalid_credentials"
    codes = [guest.login("resident@test.kz", "wrong").status_code for _ in range(10)]
    assert 429 in codes


def test_mutation_requires_csrf_header(resident: Api) -> None:
    ev = _upcoming_event(resident)
    r = resident.c.post(f"/api/events/{ev['id']}/registration")  # без X-CSRF-Token
    assert r.status_code == 403 and r.json()["code"] == "csrf_failed"
    r = resident.c.post(f"/api/events/{ev['id']}/registration", headers={"X-CSRF-Token": "forged"})
    assert r.status_code == 403
    r = resident.post(f"/api/events/{ev['id']}/registration")
    assert r.status_code in (200, 409)


def test_foreign_origin_rejected(resident: Api) -> None:
    ev = _upcoming_event(resident)
    r = resident.post(f"/api/events/{ev['id']}/registration", headers={"Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json()["code"] == "csrf_failed"


def test_logout_revokes_session_even_with_stolen_cookie(resident: Api) -> None:
    stolen = resident.c.cookies.get("eco_at")
    assert resident.post("/api/auth/logout").status_code == 204
    other = Api()
    other.c.cookies.set("eco_at", stolen)
    assert other.get("/api/auth/session").json()["user"] is None
    assert other.get("/api/me/reports").status_code == 401


def test_refresh_rotation_and_reuse_detection(resident: Api, monkeypatch) -> None:
    monkeypatch.setattr(auth_router, "REFRESH_GRACE", auth_router.timedelta(seconds=0))
    old_rt = resident.c.cookies.get("eco_rt")
    r = resident.c.post("/api/auth/refresh")
    assert r.status_code == 200
    assert resident.c.cookies.get("eco_rt") != old_rt
    # злоумышленник повторяет старый refresh-токен → все сессии пользователя отзываются
    thief = Api()
    thief.c.cookies.set("eco_rt", old_rt, path="/api/auth")
    assert thief.c.post("/api/auth/refresh").status_code == 401
    assert resident.get("/api/me/reports").status_code == 401


def test_blocked_user_loses_access(admin: Api) -> None:
    victim = Api()
    victim.login("resident2@test.kz")
    uid = victim.get("/api/auth/session").json()["user"]["id"]
    assert admin.put(f"/api/admin/users/{uid}/blocked", json={"blocked": True}).status_code == 200
    assert victim.get("/api/me/reports").status_code in (401, 403)
    assert victim.login("resident2@test.kz").json()["code"] == "user_blocked"


# ---------- права доступа ----------

def test_guest_permissions(guest: Api) -> None:
    assert guest.get("/api/events").status_code == 200
    assert guest.get("/api/reports").status_code == 200
    assert guest.get("/api/leaderboard").status_code == 200
    assert guest.post("/api/reports", json={}).status_code in (401, 422)
    ev = _upcoming_event(guest)
    assert guest.post(f"/api/events/{ev['id']}/registration").json()["code"] == "auth_required"
    assert guest.get("/api/stats/dashboard").status_code == 401
    # черновики гостю не видны
    assert all(e["status"] != "draft" for e in guest.get("/api/events").json())


def test_resident_cannot_use_admin_endpoints(resident: Api) -> None:
    ev = _upcoming_event(resident)
    rep = resident.post("/api/reports", json={"type": "other", "severity": 1, "description": "Сломана скамейка",
                                              "lat": 43.2, "lng": 76.7}).json()
    checks = [
        resident.get("/api/stats/dashboard"),
        resident.get("/api/admin/users"),
        resident.get("/api/reports/new-count"),
        resident.get(f"/api/events/{ev['id']}/participants"),
        resident.post("/api/events", json={"title": "Hack", "category": "other", "status": "published",
                                           "starts_at": "2030-01-01T10:00:00Z", "lat": 1, "lng": 1}),
        resident.post(f"/api/reports/{rep['id']}/status", json={"status": "resolved"}),
        resident.patch("/api/settings", json={"population": 1}),
    ]
    assert [r.status_code for r in checks] == [403] * len(checks)


def test_resident_cannot_escalate_via_profile(resident: Api) -> None:
    r = resident.patch("/api/auth/me", json={"role": "admin", "points": 9999})
    assert r.status_code == 422
    assert resident.get("/api/auth/session").json()["user"]["role"] == "resident"


def test_admin_cannot_block_or_demote_self(admin: Api) -> None:
    me = admin.get("/api/auth/session").json()["user"]["id"]
    assert admin.put(f"/api/admin/users/{me}/blocked", json={"blocked": True}).status_code == 403
    assert admin.put(f"/api/admin/users/{me}/role", json={"role": "resident"}).status_code == 403


def test_rank_of_other_user_forbidden(resident: Api) -> None:
    other = resident.get("/api/leaderboard", params={"period": "all"}).json()
    target = next(e for e in other if e["profile"]["first_name"] != "Ерлан")
    assert resident.get(f"/api/users/{target['profile']['id']}/rank").status_code == 403


def test_privacy_of_public_lists(guest: Api) -> None:
    assert all(r["user_id"] == "" for r in guest.get("/api/reports").json())
    assert all(r["status"] != "rejected" for r in guest.get("/api/reports").json())
    assert all(len(e["profile"]["last_name"]) <= 1 for e in guest.get("/api/leaderboard", params={"period": "all"}).json())


# ---------- валидация входа ----------

def test_report_rejects_external_photo_urls_and_requires_photo(resident: Api) -> None:
    base = {"type": "overflowing_bin", "severity": 2, "description": "Бак переполнен", "lat": 43.2, "lng": 76.7}
    assert resident.post("/api/reports", json={**base, "photo_urls": ["javascript:alert(1)"]}).status_code == 422
    assert resident.post("/api/reports", json={**base, "photo_urls": ["https://evil.example/x.jpg"]}).status_code == 422
    assert resident.post("/api/reports", json={**base, "type": "illegal_dump"}).status_code == 422
    assert resident.post("/api/reports", json=base).status_code == 201


def test_upload_validates_and_strips_metadata(resident: Api, guest: Api) -> None:
    assert guest.post("/api/uploads", files={"file": ("a.jpg", b"x", "image/jpeg")}).status_code == 401
    bad = resident.post("/api/uploads", files={"file": ("evil.jpg", b"<script>alert(1)</script>", "image/jpeg")})
    assert bad.status_code == 415
    buf = io.BytesIO()
    img = Image.new("RGB", (3000, 2000), "green")
    exif = Image.Exif()
    exif[0x010F] = "SecretCamera"
    img.save(buf, "JPEG", exif=exif)
    r = resident.post("/api/uploads", files={"file": ("p.jpg", buf.getvalue(), "image/jpeg")})
    assert r.status_code == 201
    url = r.json()["url"]
    got = resident.get(url)
    assert got.headers["content-type"] == "image/jpeg"
    assert "sandbox" in got.headers["content-security-policy"]
    out = Image.open(io.BytesIO(got.content))
    assert max(out.size) == 1600 and not out.getexif()
    assert resident.get("/api/uploads/../app/main.py").status_code == 404


# ---------- бизнес-логика ----------

def test_attendance_awards_points_once_and_revokes(admin: Api) -> None:
    res = Api()
    res.login("resident@test.kz")
    before = res.get("/api/auth/session").json()["user"]["points"]
    ev = next(e for e in admin.get("/api/events", params={"scope": "upcoming"}).json()
              if e["title"].startswith("Осенний"))
    uid = res.get("/api/auth/session").json()["user"]["id"]
    url = f"/api/events/{ev['id']}/participants/{uid}/attendance"
    assert admin.put(url, json={"attended": True}).status_code == 200
    assert admin.put(url, json={"attended": True}).status_code == 200
    after = res.get("/api/auth/session").json()["user"]["points"]
    assert after == before + ev["points_reward"]
    admin.put(url, json={"attended": False})
    assert res.get("/api/auth/session").json()["user"]["points"] == before


def test_event_capacity_enforced(admin: Api) -> None:
    full = admin.post("/api/events", json={"title": "Малое мероприятие", "category": "other", "status": "published",
                                           "starts_at": "2030-01-01T10:00:00Z", "lat": 43.2, "lng": 76.7,
                                           "max_participants": 1}).json()
    first = Api()
    first.login("resident2@test.kz")
    assert first.post(f"/api/events/{full['id']}/registration").status_code == 200
    res = Api()
    res.login("resident@test.kz")
    r = res.post(f"/api/events/{full['id']}/registration")
    assert r.status_code == 409 and r.json()["code"] == "event_full"


def test_report_confirm_awards_ten_points_once(admin: Api) -> None:
    res = Api()
    res.login("resident@test.kz")
    rep = res.post("/api/reports", json={"type": "other", "severity": 1, "description": "Сломана скамейка",
                                         "lat": 43.2, "lng": 76.73}).json()
    before = res.get("/api/auth/session").json()["user"]["points"]
    admin.post(f"/api/reports/{rep['id']}/status", json={"status": "in_progress"})
    admin.post(f"/api/reports/{rep['id']}/status", json={"status": "resolved", "comment": "Готово"})
    assert res.get("/api/auth/session").json()["user"]["points"] == before + 10
    kinds = [n["kind"] for n in res.get("/api/me/notifications").json()]
    assert kinds.count("report_status") >= 2
    # решённое пропадает с публичной карты, но остаётся в истории автора и у админа
    assert rep["id"] not in [r["id"] for r in Api().get("/api/reports").json()]
    assert rep["id"] not in [r["id"] for r in res.get("/api/reports").json()]
    assert rep["id"] in [r["id"] for r in res.get("/api/me/reports").json()]
    assert rep["id"] in [r["id"] for r in admin.get("/api/reports").json()]


# ---------- конфигурация деплоя ----------

def test_prod_config_guards_and_neon_url() -> None:
    import pytest
    from app.config import Settings

    key = "k" * 48
    s = Settings(env="prod", secret_key=key, cookie_secure=True, seed_demo=False,
                 database_url="postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db?sslmode=require")
    assert s.database_url.startswith("postgresql+psycopg://u:p@ep-x")
    assert s.access_cookie.startswith("__Host-")
    with pytest.raises(ValueError):
        Settings(env="prod", secret_key=key, cookie_secure=True, seed_demo=True, demo_password=None)
    with pytest.raises(ValueError):
        Settings(env="prod", secret_key=key, cookie_secure=False, seed_demo=False)


def test_admin_bootstrap(fresh_db: None, monkeypatch) -> None:
    from app.config import get_settings
    from app.db import SessionLocal
    from app.seed import ensure_admin

    s = get_settings()
    monkeypatch.setattr(s, "admin_email", "Boss@Abai.kz")
    monkeypatch.setattr(s, "admin_password", "very-secret-pass")
    with SessionLocal() as db:
        ensure_admin(db)
        ensure_admin(db)  # повторный запуск не дублирует
    api = Api()
    assert api.login("boss@abai.kz", "very-secret-pass").json()["user"]["role"] == "admin"


def test_seed_images_served_from_db(guest: Api) -> None:
    ev = guest.get("/api/events").json()[0]
    r = guest.get(ev["cover_url"])
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/svg+xml")
    assert "sandbox" in r.headers["content-security-policy"]


def test_demo_seed_is_small_and_reset_once(fresh_db: None) -> None:
    from sqlalchemy import func, select

    from app.db import SessionLocal
    from app.models import Event, Report, User
    from app.seed import init_db

    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id))) == 3
        assert db.scalar(select(func.count(Event.id))) == 3
        assert db.scalar(select(func.count(Report.id))) == 0
        db.add(Report(user_id=db.scalar(select(User.id).limit(1)), type="other", severity=1, description="x",
                      lat=43.2, lng=76.7, photo_urls=[]))
        db.commit()
    init_db(seed_if_empty=True)  # версия та же — данные не трогаем
    with SessionLocal() as db:
        assert db.scalar(select(func.count(Report.id))) == 1


def test_outdated_demo_db_is_wiped(fresh_db: None) -> None:
    from sqlalchemy import delete, func, select

    from app.db import SessionLocal
    from app.models import AppMeta, User
    from app.seed import init_db

    with SessionLocal() as db:
        db.add(User(email="old@mail.kz", password_hash="x", first_name="Old", last_name="User"))
        db.execute(delete(AppMeta))  # как в базе прошлой версии, где метки ещё не было
        db.commit()
    init_db(seed_if_empty=True)
    with SessionLocal() as db:
        assert db.scalar(select(func.count(User.id))) == 3
        assert db.scalar(select(User).where(User.email == "old@mail.kz")) is None
