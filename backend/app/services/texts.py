"""Тексты уведомлений на языке получателя (users.locale)."""

TEXTS: dict[str, dict[str, str]] = {
    "ru": {
        "badge_title": "{icon} Новый значок «{name}»",
        "badge_body": "Поздравляем! Значок добавлен в ваш профиль.",
        "report_status_title": "Статус обращения изменён",
        "report_status_body": "Новый статус: {status}",
        "reminder_title": "Скоро мероприятие",
        "reminder_body": "Не забудьте: «{title}»",
        "new_report_title": "Новое обращение",
        "event_updated_title": "Мероприятие изменено",
        "event_updated_body": "Изменились время или место: «{title}»",
        "event_cancelled_title": "Мероприятие отменено",
        "event_cancelled_body": "К сожалению, «{title}» отменено",
        "copy_suffix": "(копия)",
        "status.new": "Новая",
        "status.in_review": "На рассмотрении",
        "status.in_progress": "В работе",
        "status.resolved": "Решено",
        "status.rejected": "Отклонено",
        "type.illegal_dump": "Стихийная свалка",
        "type.toxic_release": "Токсичный выброс",
        "type.overflowing_bin": "Переполненный бак",
        "type.burning": "Сжигание мусора",
        "type.water_pollution": "Загрязнение воды",
        "type.other": "Другое",
    },
    "kk": {
        "badge_title": "{icon} Жаңа белгіше «{name}»",
        "badge_body": "Құттықтаймыз! Белгіше профиліңізге қосылды.",
        "report_status_title": "Өтініш мәртебесі өзгерді",
        "report_status_body": "Жаңа мәртебе: {status}",
        "reminder_title": "Іс-шара жақында",
        "reminder_body": "Ұмытпаңыз: «{title}»",
        "new_report_title": "Жаңа өтініш",
        "event_updated_title": "Іс-шара өзгерді",
        "event_updated_body": "Уақыты немесе орны өзгерді: «{title}»",
        "event_cancelled_title": "Іс-шара болдырылмады",
        "event_cancelled_body": "Өкінішке қарай, «{title}» болдырылмады",
        "copy_suffix": "(көшірме)",
        "status.new": "Жаңа",
        "status.in_review": "Қаралуда",
        "status.in_progress": "Жұмыста",
        "status.resolved": "Шешілді",
        "status.rejected": "Қабылданбады",
        "type.illegal_dump": "Заңсыз қоқыс үйіндісі",
        "type.toxic_release": "Улы шығарынды",
        "type.overflowing_bin": "Толып кеткен контейнер",
        "type.burning": "Қоқыс өртеу",
        "type.water_pollution": "Судың ластануы",
        "type.other": "Басқа",
    },
}


def tr(locale: str, key: str, **params: object) -> str:
    table = TEXTS.get(locale) or TEXTS["ru"]
    return table.get(key, TEXTS["ru"].get(key, key)).format(**params)
