"""Единый формат ошибок: {"code": "..."} — фронтенд переводит код через i18n (errors.<code>)."""
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

ErrorCode = Literal[
    "auth_required",
    "token_expired",
    "forbidden",
    "csrf_failed",
    "invalid_credentials",
    "email_taken",
    "user_blocked",
    "not_found",
    "event_full",
    "event_closed",
    "already_registered",
    "validation",
    "upload_failed",
    "invalid_token",
    "rate_limited",
    "unknown",
]


class ApiError(Exception):
    def __init__(self, status: int, code: ErrorCode, headers: dict[str, str] | None = None) -> None:
        self.status = status
        self.code = code
        self.headers = headers


def install_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse({"code": exc.code}, status_code=exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": list(e.get("loc", [])), "msg": e.get("msg", "")} for e in exc.errors()]
        return JSONResponse({"code": "validation", "errors": errors}, status_code=422)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "forbidden" if exc.status_code == 403 else "unknown"
        return JSONResponse({"code": code}, status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, __: Exception) -> JSONResponse:
        # детали не раскрываем клиенту — они уходят в лог uvicorn
        return JSONResponse({"code": "unknown"}, status_code=500)
