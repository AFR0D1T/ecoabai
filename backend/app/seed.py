"""Демо-данные: 3 аккаунта (админ и два жителя), 3 мероприятия, значки.

Запуск вручную:  python -m app.seed --reset
"""
import argparse
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .db import Base, SessionLocal, engine, utcnow
from .models import (
    AppMeta, Badge, Event, EventParticipant, Notification, StoredFile, User, VillageSettings,
)
from .security import hash_password
from .services.gamification import award_points, check_badges

CENTER = (43.2105, 76.7606)  # село Абай, Карасайский р-н (синхронно с src/config.ts)
TEST_PASSWORD = "123456"
DEMO_VERSION = "2"  # увеличить, чтобы демо-база один раз пересоздалась при деплое

BADGES = [
    ("first_step", "Первый шаг", "Алғашқы қадам", "Первое подтверждённое обращение или участие в мероприятии",
     "Алғашқы расталған өтініш немесе іс-шараға қатысу", "🌱"),
    ("sharp_eye", "Зоркий глаз", "Қырағы көз", "5 подтверждённых обращений", "5 расталған өтініш", "👁️"),
    ("cleanup_x3", "Субботник ×3", "Сенбілік ×3", "3 засчитанных участия в уборках", "Тазалау шараларына 3 рет қатысу", "🧹"),
    ("tree_planter", "Посадил дерево", "Ағаш отырғыздым", "Участие в посадке деревьев", "Ағаш отырғызуға қатысу", "🌳"),
    ("sorter", "Сортировщик", "Сұрыптаушы", "Участие в сборе вторсырья", "Қайталама шикізат жинауға қатысу", "♻️"),
    ("eco_leader", "Эко-лидер месяца", "Айдың эко-көшбасшысы", "Первое место в рейтинге за месяц",
     "Айлық рейтингте бірінші орын", "🏆"),
]

SVG_ART = {
    "cover_cleanup": ("🧹", "#43a047", "#1b5e20"), "cover_tree_planting": ("🌳", "#66bb6a", "#2e7d32"),
    "cover_recycling": ("♻️", "#26a69a", "#00695c"), "cover_lecture": ("🎓", "#5c6bc0", "#283593"),
    "cover_other": ("🌍", "#8d6e63", "#4e342e"),
    "photo_illegal_dump": ("🗑️", "#8d6e63", "#3e2723"), "photo_toxic_release": ("☣️", "#9e9d24", "#33691e"),
    "photo_overflowing_bin": ("🚮", "#78909c", "#37474f"), "photo_burning": ("🔥", "#ff7043", "#bf360c"),
    "photo_water_pollution": ("💧", "#4fc3f7", "#01579b"), "photo_other": ("⚠️", "#bdbdbd", "#616161"),
    "resolved": ("✨", "#a5d6a7", "#2e7d32"),
}

def write_svgs(db: Session) -> None:
    for name, (emoji, c1, c2) in SVG_ART.items():
        svg = (f"<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450' viewBox='0 0 800 450'>"
               f"<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{c1}'/>"
               f"<stop offset='1' stop-color='{c2}'/></linearGradient></defs><rect width='800' height='450' fill='url(#g)'/>"
               f"<circle cx='680' cy='80' r='120' fill='white' fill-opacity='0.08'/>"
               f"<text x='400' y='285' font-size='170' text-anchor='middle'>{emoji}</text></svg>")
        key = f"seed/{name.replace('_', '-')}.svg"
        if not db.get(StoredFile, key):
            db.add(StoredFile(name=key, content_type="image/svg+xml", data=svg.encode("utf-8")))


def art(name: str) -> str:
    return f"/api/uploads/seed/{name.replace('_', '-')}.svg"


def seed(db: Session) -> None:
    now = utcnow()
    lat0, lng0 = CENTER
    write_svgs(db)

    db.add(VillageSettings(id=1, name_ru="село Абай", name_kk="Абай ауылы", population=3200,
                           center_lat=lat0, center_lng=lng0, default_zoom=15, bounds=None))
    db.add_all(Badge(code=c, name_ru=nr, name_kk=nk, description_ru=dr, description_kk=dk, icon=i)
               for c, nr, nk, dr, dk, i in BADGES)
    db.flush()
    _seed_demo(db, now, lat0, lng0)


def _seed_demo(db: Session, now: datetime, lat0: float, lng0: float) -> None:
    """Небольшой набор для показа: 3 аккаунта и 3 мероприятия, без обращений."""
    pw = hash_password(get_settings().demo_password or TEST_PASSWORD)  # в prod — ECOABAI_DEMO_PASSWORD

    def mk(first: str, last: str, email: str, days: int, **kw: object) -> User:
        u = User(email=email, password_hash=pw, first_name=first, last_name=last,
                 created_at=now - timedelta(days=days), last_active_at=now - timedelta(hours=2), **kw)
        db.add(u)
        return u

    admin = mk("Айгуль", "Сарсенова", "admin@test.kz", 60, role="admin")
    resident = mk("Ерлан", "Тулегенов", "resident@test.kz", 45)
    resident2 = mk("Асель", "Ахметова", "resident2@test.kz", 40)
    db.flush()

    def at(days: int, hour: int) -> datetime:
        d = (now + timedelta(days=days)).astimezone(timezone(timedelta(hours=5)))  # время Казахстана
        return d.replace(hour=hour, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

    ev_defs = [
        ("Субботник на берегу реки", "Убираем мусор вдоль берега реки и у моста. Перчатки и мешки выдадим на месте. Возьмите удобную обувь и воду.",
         "cleanup", "finished", -20, 10, 3, -0.0045, 0.0062, "Берег реки, у моста", 30, 20),
        ("Осенний субботник у магазина «Береке»", "Сгребаем листву, убираем стихийную свалку неподалёку. Встречаемся у магазина «Береке».",
         "cleanup", "published", 3, 10, 3, -0.003, -0.004, "Магазин «Береке»", 30, 20),
        ("Посадка аллеи в сквере", "Высаживаем аллею из 20 берёз. Количество мест ограничено числом лопат.",
         "tree_planting", "published", 10, 10, 4, 0.0048, 0.0002, "Сквер у акимата", 10, 25),
    ]
    events: list[Event] = []
    for title, desc, cat, st, days, hour, hours, dlat, dlng, addr, mx, reward in ev_defs:
        start = at(days, hour)
        e = Event(title=title, description=desc, category=cat, status=st, starts_at=start,
                  ends_at=start + timedelta(hours=hours), lat=lat0 + dlat, lng=lng0 + dlng, address=addr,
                  max_participants=mx, cover_url=art(f"cover_{cat}"), points_reward=reward, created_by=admin.id,
                  created_at=min(start - timedelta(days=14), now - timedelta(days=1)))
        db.add(e)
        events.append(e)
    db.flush()

    finished, upcoming = events[0], events[1]
    for u in (resident, resident2):
        db.add(EventParticipant(event_id=finished.id, user_id=u.id, status="attended",
                                registered_at=finished.starts_at - timedelta(days=5)))
        db.add(EventParticipant(event_id=upcoming.id, user_id=u.id, status="registered", registered_at=now - timedelta(days=1)))
    db.flush()
    for u in (resident, resident2):
        award_points(db, u.id, finished.points_reward, "event_attended", finished.id, finished.ends_at)
    db.flush()
    for u in (resident, resident2):
        check_badges(db, u.id, notify_user=False, earned_at=finished.ends_at)
    db.flush()
    for n in db.scalars(select(Notification)):
        n.is_read = True
    db.merge(AppMeta(key="demo_version", value=DEMO_VERSION))
    db.commit()


def ensure_admin(db: Session) -> None:
    """Первый администратор из ECOABAI_ADMIN_EMAIL / ECOABAI_ADMIN_PASSWORD (если задан и ещё не существует)."""
    s = get_settings()
    if not s.admin_email or not s.admin_password:
        return
    email = s.admin_email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user:
        if user.role != "admin":
            user.role = "admin"
            db.commit()
        return
    db.add(User(email=email, password_hash=hash_password(s.admin_password), first_name="Администратор",
                last_name="Абай", role="admin"))
    db.commit()


def reset_outdated_demo(seed_if_empty: bool) -> None:
    """Если в базе демо-данные старой версии — удаляем всё и заполняем заново (один раз на версию).
    Работает только при ECOABAI_SEED_DEMO=true; с настоящими данными (seed_demo=false) ничего не трогает."""
    if not seed_if_empty:
        return
    tables = inspect(engine).get_table_names()
    if "village_settings" not in tables:
        return  # пустая база — обычное заполнение
    version = None
    if "app_meta" in tables:
        with engine.connect() as conn:
            version = conn.execute(text("SELECT value FROM app_meta WHERE key = 'demo_version'")).scalar()
    if version == DEMO_VERSION:
        return
    with engine.begin() as conn:
        if engine.dialect.name == "postgresql":  # таблицы прошлых версий (например, streets)
            conn.execute(text("DROP TABLE IF EXISTS streets CASCADE"))
    Base.metadata.drop_all(engine)


def init_db(seed_if_empty: bool) -> None:
    reset_outdated_demo(seed_if_empty)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.get(VillageSettings, 1):
            if seed_if_empty:
                seed(db)
            else:  # чистый запуск: настройки и значки, без демо-жителей
                write_svgs(db)
                db.add(VillageSettings(id=1, name_ru="село Абай", name_kk="Абай ауылы", population=3200,
                                       center_lat=CENTER[0], center_lng=CENTER[1], default_zoom=15))
                db.add_all(Badge(code=c, name_ru=nr, name_kk=nk, description_ru=dr, description_kk=dk, icon=i)
                           for c, nr, nk, dr, dk, i in BADGES)
                db.commit()
        write_svgs(db)  # картинки демо-данных (идемпотентно)
        db.commit()
        ensure_admin(db)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="удалить все таблицы и заполнить заново")
    args = parser.parse_args()
    if args.reset:
        Base.metadata.drop_all(engine)
    init_db(seed_if_empty=True)
    print("OK")
