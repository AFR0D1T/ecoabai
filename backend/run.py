"""Запуск dev-сервера API: python run.py  (рабочая папка — backend/, чтобы .env, БД и uploads лежали здесь)."""
import os
import sys
from pathlib import Path

import uvicorn

if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    reload = "--no-reload" not in sys.argv
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=reload, proxy_headers=True,
                forwarded_allow_ips="127.0.0.1")
