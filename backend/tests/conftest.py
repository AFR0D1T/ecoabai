import os
import shutil
import tempfile
from collections.abc import Iterator

_tmp = tempfile.mkdtemp(prefix="ecoabai-test-")
os.environ["ECOABAI_DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["ECOABAI_UPLOAD_DIR"] = f"{_tmp}/uploads"
os.environ["ECOABAI_SEED_DEMO"] = "true"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.security import limiter  # noqa: E402
from app.seed import init_db  # noqa: E402

ORIGIN = "http://localhost:5173"


@pytest.fixture(scope="session", autouse=True)
def _cleanup() -> Iterator[None]:
    yield
    engine.dispose()
    shutil.rmtree(_tmp, ignore_errors=True)


@pytest.fixture()
def fresh_db() -> None:
    Base.metadata.drop_all(engine)
    init_db(seed_if_empty=True)
    limiter.reset()


class Api:
    """Клиент как браузер: cookie хранит сам, csrf берёт из тела ответа входа."""

    def __init__(self) -> None:
        self.c = TestClient(app, base_url="http://localhost", headers={"Origin": ORIGIN})
        self.csrf: str | None = None

    def login(self, email: str, password: str = "123456"):
        r = self.c.post("/api/auth/login", json={"email": email, "password": password})
        if r.status_code == 200:
            self.csrf = r.json()["csrf_token"]
        return r

    def h(self) -> dict[str, str]:
        return {"X-CSRF-Token": self.csrf} if self.csrf else {}

    def get(self, url: str, **kw):
        return self.c.get(url, **kw)

    def post(self, url: str, **kw):
        return self.c.post(url, headers={**self.h(), **kw.pop("headers", {})}, **kw)

    def put(self, url: str, **kw):
        return self.c.put(url, headers={**self.h(), **kw.pop("headers", {})}, **kw)

    def patch(self, url: str, **kw):
        return self.c.patch(url, headers={**self.h(), **kw.pop("headers", {})}, **kw)

    def delete(self, url: str, **kw):
        return self.c.delete(url, headers={**self.h(), **kw.pop("headers", {})}, **kw)


@pytest.fixture()
def guest(fresh_db: None) -> Api:
    return Api()


@pytest.fixture()
def resident(fresh_db: None) -> Api:
    a = Api()
    assert a.login("resident@test.kz").status_code == 200
    return a


@pytest.fixture()
def admin(fresh_db: None) -> Api:
    a = Api()
    assert a.login("admin@test.kz").status_code == 200
    return a
