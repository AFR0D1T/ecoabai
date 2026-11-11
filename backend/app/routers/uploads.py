"""Загрузка фото: проверка, что это действительно картинка, перекодирование в JPEG (удаляет EXIF и GPS),
ограничение размера. Файлы хранятся в БД (таблица files), раздаются с запретом исполнения (CSP + nosniff)."""
import io
import re
import uuid

from fastapi import APIRouter, Depends, File, Response, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..errors import ApiError
from ..models import StoredFile, User
from ..schemas import UploadOut
from ..security import limiter

router = APIRouter(tags=["uploads"])
Image.MAX_IMAGE_PIXELS = 40_000_000  # защита от «декомпрессионной бомбы»
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "GIF", "BMP", "MPO"}
MAX_SIDE = 1600
NAME_RE = re.compile(r"^(?:[0-9a-f]{32}\.jpg|seed/[a-z0-9_-]{1,40}\.svg)$")


@router.post("/uploads", response_model=UploadOut, status_code=201)
async def upload(file: UploadFile = File(...), user: User = Depends(current_user),
                 db: Session = Depends(get_db)) -> UploadOut:
    limiter.hit(f"upload:user:{user.id}", 30, 600)
    max_bytes = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if not data or len(data) > max_bytes:
        raise ApiError(413, "upload_failed")
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise ApiError(415, "upload_failed")
        img.load()
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ApiError(415, "upload_failed") from e
    out = io.BytesIO()
    img.save(out, "JPEG", quality=84, optimize=True)  # EXIF не сохраняем
    name = f"{uuid.uuid4().hex}.jpg"
    db.add(StoredFile(name=name, content_type="image/jpeg", data=out.getvalue()))
    db.commit()
    return UploadOut(url=f"/api/uploads/{name}")


@router.get("/uploads/{name:path}")
def serve_upload(name: str, db: Session = Depends(get_db)) -> Response:
    if not NAME_RE.match(name):
        raise ApiError(404, "not_found")
    f = db.get(StoredFile, name)
    if not f:
        raise ApiError(404, "not_found")
    return Response(f.data, media_type=f.content_type, headers={
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
    })
