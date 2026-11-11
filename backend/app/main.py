from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .errors import install_handlers
from .routers import auth, community, events, reports, settings, stats, uploads
from .seed import init_db

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db(seed_if_empty=get_settings().seed_demo)
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="EcoAbai API",
        version="1.0.0",
        lifespan=lifespan,
        # документация API только в dev
        docs_url="/api/docs" if s.env == "dev" else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if s.env == "dev" else None,
    )
    install_handlers(app)

    @app.middleware("http")
    async def origin_guard_and_headers(request: Request, call_next):
        # Защита от CSRF №1: изменяющие запросы принимаем только с разрешённых Origin
        if request.method in UNSAFE:
            origin = request.headers.get("origin")
            if not origin and (ref := request.headers.get("referer")):
                parts = urlsplit(ref)
                origin = f"{parts.scheme}://{parts.netloc}"
            if origin and origin not in s.allowed_origins:
                return JSONResponse({"code": "csrf_failed"}, status_code=403)
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if request.url.path.startswith("/api/") and not request.url.path.startswith("/api/uploads/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if s.cookie_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    # CORS нужен только если фронт на другом домене; с cookie — строго по списку, без "*"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    for r in (auth, events, reports, community, settings, stats, uploads):
        app.include_router(r.router, prefix="/api")

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
