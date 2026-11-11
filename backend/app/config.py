"""Настройки приложения (переменные окружения с префиксом ECOABAI_ или файл .env)."""
from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ECOABAI_", extra="ignore")

    env: Literal["dev", "prod"] = "dev"
    secret_key: str = Field(default=DEV_SECRET, min_length=32)
    database_url: str = "sqlite:///./ecoabai.db"

    access_ttl_minutes: int = 15
    refresh_ttl_days: int = 30
    reset_ttl_minutes: int = 60

    # В prod обязательно True (HTTPS). Тогда cookie получают префиксы __Host- / __Secure-.
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict"] = "lax"

    # Откуда разрешены запросы, меняющие данные (проверка Origin) и CORS
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    frontend_url: str = "http://localhost:5173"

    max_upload_mb: int = 8  # фото хранятся в БД (переживают перезапуски бесплатных хостингов)

    seed_demo: bool = True  # заполнить пустую БД демо-данными при первом запуске
    # пароль демо-аккаунтов; в prod обязателен, если seed_demo=true (не «123456»!)
    demo_password: str | None = None
    # первый администратор (создаётся при старте, если его ещё нет)
    admin_email: str | None = None
    admin_password: str | None = Field(default=None, min_length=8)

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Neon/Render/Heroku выдают postgres:// или postgresql:// — указываем драйвер psycopg 3
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @model_validator(mode="after")
    def _check_prod(self) -> "Settings":
        if self.env == "prod":
            if self.secret_key == DEV_SECRET:
                raise ValueError("ECOABAI_SECRET_KEY must be set in production")
            if not self.cookie_secure:
                raise ValueError("ECOABAI_COOKIE_SECURE must be true in production")
            if self.seed_demo and (not self.demo_password or len(self.demo_password) < 8):
                raise ValueError("ECOABAI_DEMO_PASSWORD (8+ chars) is required when SEED_DEMO=true in production")
        return self

    # имена cookie
    @property
    def access_cookie(self) -> str:
        return "__Host-eco_at" if self.cookie_secure else "eco_at"

    @property
    def refresh_cookie(self) -> str:
        return "__Secure-eco_rt" if self.cookie_secure else "eco_rt"


@lru_cache
def get_settings() -> Settings:
    return Settings()
