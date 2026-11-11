"""Демо-данные: ~40 жителей, 8 мероприятий, 25 обращений, значки.

Запуск вручную:  python -m app.seed --reset
"""
import argparse
import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from .config import get_settings
from .db import Base, SessionLocal, engine, utcnow
from .models import (
    Badge, StoredFile, Event, EventParticipant, Notification, PointTransaction, Report, ReportStatusChange, User,
    VillageSettings,
)
from .security import hash_password
from .services.gamification import REPORT_CONFIRMED_POINTS, award_points, check_badges, notify
from .services.texts import tr

CENTER = (43.2105, 76.7606)  # село Абай, Карасайский р-н (синхронно с src/config.ts)
TEST_PASSWORD = "123456"

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

MALE = (["Ерлан", "Нурлан", "Асхат", "Данияр", "Бауыржан", "Арман", "Сергей", "Алексей", "Тимур", "Руслан", "Айдос",
         "Марат", "Дмитрий", "Ержан"],
        ["Тулегенов", "Сейткали", "Жумабаев", "Ахметов", "Иванов", "Касымов", "Петров", "Омаров", "Исаев", "Беков",
         "Мусин", "Садыков"])
FEMALE = (["Айгуль", "Динара", "Асель", "Мадина", "Гульнара", "Жанар", "Ольга", "Елена", "Сауле", "Айжан", "Наталья",
           "Камила", "Алия"],
          ["Сарсенова", "Ахметова", "Иванова", "Касымова", "Нуркенова", "Смагулова", "Петрова", "Омарова", "Бекова",
           "Мусина", "Садыкова"])


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
    rnd = random.Random(20241111)
    now = utcnow()
    lat0, lng0 = CENTER
    write_svgs(db)

    db.add(VillageSettings(id=1, name_ru="село Абай", name_kk="Абай ауылы", population=3200,
                           center_lat=lat0, center_lng=lng0, default_zoom=15, bounds=None))
    db.add_all(Badge(code=c, name_ru=nr, name_kk=nk, description_ru=dr, description_kk=dk, icon=i)
               for c, nr, nk, dr, dk, i in BADGES)
    db.flush()
    _seed_demo(db, rnd, now, lat0, lng0)


def _seed_demo(db: Session, rnd: random.Random, now: datetime, lat0: float, lng0: float) -> None:

    # один хэш на всех демо-пользователей — сид быстрее; в prod пароль задаётся ECOABAI_DEMO_PASSWORD
    pw = hash_password(get_settings().demo_password or TEST_PASSWORD)

    def mk(first: str, last: str, email: str, **kw: object) -> User:
        created = now - timedelta(days=rnd.randint(5, 150), seconds=rnd.randint(0, 86000))
        u = User(email=email, password_hash=pw, first_name=first, last_name=last,
                 created_at=created,
                 last_active_at=max(created, now - timedelta(days=rnd.randint(0, 45), seconds=rnd.randint(0, 80000))),
                 **kw)
        db.add(u)
        return u

    admin = mk("Айгуль", "Сарсенова", "admin@test.kz", role="admin")
    admin.created_at, admin.last_active_at = now - timedelta(days=200), now - timedelta(hours=1)
    resident = mk("Ерлан", "Тулегенов", "resident@test.kz")
    resident.created_at, resident.last_active_at = now - timedelta(days=90), now - timedelta(hours=2)
    used: set[str] = set()
    others: list[User] = []
    for i in range(38):
        firsts, lasts = MALE if rnd.random() < 0.5 else FEMALE
        first, last = rnd.choice(firsts), rnd.choice(lasts)
        while first + last in used:
            first, last = rnd.choice(firsts), rnd.choice(lasts)
        used.add(first + last)
        u = mk(first, last, f"user{i + 1}@mail.kz", is_blocked=(i == 37))
        if i != 37:
            others.append(u)
    db.flush()

    # мероприятия
    def at(days: int, hour: int) -> datetime:
        d = (now + timedelta(days=days)).astimezone(timezone(timedelta(hours=5)))  # время Казахстана
        return d.replace(hour=hour, minute=0, second=0, microsecond=0).astimezone(timezone.utc)

    ev_defs = [
        ("Субботник на берегу реки", "Убираем мусор вдоль берега реки и у моста. Перчатки и мешки выдадим на месте. Возьмите удобную обувь и воду.",
         "cleanup", "finished", -40, 10, 3, -0.0045, 0.0062, "Берег реки, у моста", 30, 20),
        ("Посадка деревьев у школы", "Высаживаем 40 саженцев карагача и клёна вокруг школьного двора. Лопаты есть, приходите всей семьёй!",
         "tree_planting", "finished", -25, 11, 3, 0.0034, -0.002, "Школа, школьный двор", 25, 25),
        ("Сбор вторсырья: пластик и макулатура", "Принимаем чистый пластик (ПЭТ), картон и бумагу. Всё вывезем на переработку в город.",
         "recycling", "finished", -10, 12, 4, 0.0004, 0.0006, "Площадь у акимата", None, 15),
        ("Осенний субботник у магазина «Береке»", "Сгребаем листву, убираем стихийную свалку неподалёку. Встречаемся у магазина «Береке».",
         "cleanup", "published", 3, 10, 3, -0.003, -0.004, "Магазин «Береке»", 30, 20),
        ("Лекция «Сортировка отходов дома»", "Рассказываем, как разделять отходы, что принимают пункты приёма и как уменьшить количество мусора в семье.",
         "lecture", "published", 6, 18, 1, 0.0008, -0.0006, "Дом культуры", 30, 10),
        ("Сбор батареек и ламп", "Батарейки и энергосберегающие лампы нельзя выбрасывать в общий бак. Сдайте их — отправим на утилизацию.",
         "recycling", "published", 12, 11, 5, 0.0012, 0.0049, "У почты", None, 15),
        ("Посадка аллеи в сквере", "Высаживаем аллею из 20 берёз. Количество мест ограничено числом лопат.",
         "tree_planting", "published", 20, 10, 4, 0.0048, 0.0002, "Сквер у акимата", 10, 25),
        ("Эко-квест для детей", "Игра по станциям для детей 7–12 лет: узнаём, как помочь природе родного села.",
         "other", "draft", 30, 15, 2, -0.001, 0.002, "Школьный стадион", 40, 20),
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

    for idx, e in enumerate(events):
        if e.status == "draft":
            continue
        past = e.status == "finished"
        count = 10 if idx == 6 else rnd.randint(10, 18) if past else rnd.randint(4, 12)
        pool = others[:]
        rnd.shuffle(pool)
        chosen = pool[:count]
        if idx in (0, 1, 3):
            chosen[0] = resident
        for u in chosen:
            status = ("attended" if u is resident or rnd.random() < 0.78 else "no_show") if past else "registered"
            db.add(EventParticipant(event_id=e.id, user_id=u.id, status=status,
                                    registered_at=e.starts_at - timedelta(days=rnd.randint(1, 12))))
    db.flush()

    # обращения
    types = ["illegal_dump", "toxic_release", "overflowing_bin", "burning", "water_pollution", "other"]
    plan = ["new"] * 6 + ["in_review"] * 4 + ["in_progress"] * 5 + ["resolved"] * 8 + ["rejected"] * 2
    rnd.shuffle(plan)
    descs = {
        "illegal_dump": ["Строительный мусор свалили за гаражами.", "Куча бытового мусора у дороги, растёт каждую неделю.",
                         "Выбросили старую мебель и шины в овраг."],
        "toxic_release": ["Резкий химический запах из канавы, вода странного цвета.", "Кто-то слил отработанное масло на землю."],
        "overflowing_bin": ["Контейнеры переполнены, мусор разносит ветер.", "Баки не вывозили больше недели."],
        "burning": ["Жгут листву и пластик, весь двор в дыму.", "Горит свалка на окраине, дым идёт на дома."],
        "water_pollution": ["В арыке плавает мусор и пена.", "Пятно масла на воде у моста."],
        "other": ["Сломана урна на остановке.", "Разбитое стекло на детской площадке."],
    }
    comments = {
        "rejected": ["Дубликат обращения, уже в работе.", "Не удалось подтвердить проблему на месте."],
        "in_progress": ["Передали в коммунальную службу, вывоз запланирован.", "Проверили на месте, организуем уборку."],
        "resolved": ["Мусор вывезен, территория убрана. Спасибо за сигнал!", "Проблема устранена."],
    }
    chains = {"new": ["new"], "in_review": ["new", "in_review"], "in_progress": ["new", "in_review", "in_progress"],
              "resolved": ["new", "in_review", "in_progress", "resolved"], "rejected": ["new", "in_review", "rejected"]}
    for i, st in enumerate(plan):
        t = rnd.choice(types)
        sev = 3 if t == "toxic_release" else rnd.randint(1, 3)
        author = resident if i in (2, 8, 12, 18) else rnd.choice(others)
        created = now - timedelta(days=rnd.randint(0, 5) if st == "new" else rnd.randint(6, 120), seconds=rnd.randint(0, 80000))
        ang, r = rnd.random() * math.tau, 0.001 + rnd.random() * 0.0055
        lat, lng = lat0 + math.sin(ang) * r * 0.8, lng0 + math.cos(ang) * r
        rep = Report(user_id=author.id, type=t, severity=sev, description=rnd.choice(descs[t]), lat=lat, lng=lng,
                     status=st,
                     photo_urls=[art(f"photo_{t}")] * rnd.randint(1, 2), created_at=created, updated_at=created)
        db.add(rep)
        db.flush()
        ts, last_comment, confirmed_at = created, None, None
        for step in chains[st]:
            c = rnd.choice(comments[step]) if step in comments else None
            last_comment = c or last_comment
            ts = min(ts, now - timedelta(hours=1))
            db.add(ReportStatusChange(report_id=rep.id, status=step, comment=c,
                                      changed_by=author.id if step == "new" else admin.id, changed_at=ts))
            if step == "in_progress":
                confirmed_at = ts
            rep.updated_at = ts
            if step == "resolved":
                rep.resolved_at = ts
            ts += timedelta(hours=rnd.randint(4, 72))
        rep.admin_comment = last_comment
        if st == "resolved" and rnd.random() < 0.7:
            rep.resolved_photo_url = art("resolved")
        if confirmed_at:
            award_points(db, author.id, REPORT_CONFIRMED_POINTS, "report_confirmed", rep.id, confirmed_at)
    db.flush()

    for e in events:
        for p in db.scalars(select(EventParticipant).where(EventParticipant.event_id == e.id,
                                                           EventParticipant.status == "attended")):
            award_points(db, p.user_id, e.points_reward, "event_attended", e.id, e.ends_at)
    db.flush()
    for u in db.scalars(select(User)):
        last = db.scalar(select(PointTransaction.created_at).where(PointTransaction.user_id == u.id)
                         .order_by(PointTransaction.created_at.desc()).limit(1))
        check_badges(db, u.id, notify_user=False, earned_at=last or u.created_at)

    # стартовые уведомления
    my_rep = db.scalar(select(Report).where(Report.user_id == resident.id, Report.status != "new").limit(1))
    if my_rep:
        notify(db, resident, "report_status", tr("ru", "report_status_title"),
               tr("ru", "report_status_body", status=tr("ru", f"status.{my_rep.status}")),
               f"/profile#report-{my_rep.id}", my_rep.updated_at)
    upcoming = events[3]
    notify(db, resident, "event_reminder", "Скоро мероприятие", f"Не забудьте: «{upcoming.title}»",
           f"/events/{upcoming.id}", now - timedelta(hours=3))
    for rep in db.scalars(select(Report).where(Report.status == "new").limit(4)):
        notify(db, admin, "new_report", tr("ru", "new_report_title"), tr("ru", f"type.{rep.type}"), f"/admin/reports?id={rep.id}",
               rep.created_at)
    db.flush()
    for n in db.scalars(select(Notification).where(Notification.kind == "badge_earned")):
        n.is_read = True
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


# Старые демо-данные с выдуманными улицами → нейтральные названия (для уже развёрнутых баз).
LEGACY_EVENTS = {
    "Осенний субботник на Садовой": ("Осенний субботник у магазина «Береке»", "Магазин «Береке»"),
    "Посадка аллеи на Центральной": ("Посадка аллеи в сквере", "Сквер у акимата"),
}
LEGACY_ADDRESSES = {
    "ул. Школьная, 12 (школа)": "Школа, школьный двор",
    "ул. Садовая, магазин «Береке»": "Магазин «Береке»",
    "Дом культуры, ул. Абая, 5": "Дом культуры",
    "ул. Жамбыла, 20, у почты": "У почты",
    "ул. Центральная, сквер": "Сквер у акимата",
}


def drop_legacy_streets() -> None:
    """Улицы убраны из приложения: удаляем их таблицу и столбцы street_id (идемпотентно)."""
    if engine.dialect.name != "postgresql":
        return  # локальная SQLite: лишние nullable-столбцы ничему не мешают
    if "streets" not in inspect(engine).get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS street_id"))
        conn.execute(text("ALTER TABLE reports DROP COLUMN IF EXISTS street_id"))
        conn.execute(text("DROP TABLE IF EXISTS streets"))


def rename_legacy_events(db: Session) -> None:
    for ev in db.scalars(select(Event)):
        if ev.title in LEGACY_EVENTS:
            ev.title, ev.address = LEGACY_EVENTS[ev.title]
            if ev.description.endswith("в конце улицы. Встречаемся у магазина «Береке»."):
                ev.description = ev.description.replace("в конце улицы", "неподалёку")
        if ev.address in LEGACY_ADDRESSES:
            ev.address = LEGACY_ADDRESSES[ev.address]
    db.commit()


def init_db(seed_if_empty: bool) -> None:
    drop_legacy_streets()
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
        rename_legacy_events(db)
        ensure_admin(db)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="удалить все таблицы и заполнить заново")
    args = parser.parse_args()
    if args.reset:
        Base.metadata.drop_all(engine)
    init_db(seed_if_empty=True)
    print("OK")
