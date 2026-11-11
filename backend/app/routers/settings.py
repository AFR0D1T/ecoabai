from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..errors import ApiError
from ..models import User, VillageSettings
from ..schemas import SettingsOut, SettingsPatchIn

router = APIRouter(tags=["settings"])


def _settings(db: Session) -> VillageSettings:
    s = db.get(VillageSettings, 1)
    if not s:
        raise ApiError(404, "not_found")
    return s


@router.get("/settings", response_model=SettingsOut)
def get_settings_(db: Session = Depends(get_db)) -> VillageSettings:
    return _settings(db)


@router.patch("/settings", response_model=SettingsOut)
def update_settings(body: SettingsPatchIn, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> VillageSettings:
    s = _settings(db)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        if v is None and k != "bounds":
            raise ApiError(422, "validation")
        setattr(s, k, v)
    db.commit()
    return s
