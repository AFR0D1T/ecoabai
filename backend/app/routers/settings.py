from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import require_admin
from ..errors import ApiError
from ..models import Street, User, VillageSettings
from ..schemas import Lat, Lng, SettingsOut, SettingsPatchIn, StreetIn, StreetOut
from ..services import geo

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


@router.get("/streets", response_model=list[StreetOut])
def list_streets(db: Session = Depends(get_db)) -> list[Street]:
    return list(db.scalars(select(Street).order_by(Street.name_ru)))


@router.get("/streets/nearest", response_model=str | None)
def nearest_street(lat: Lat, lng: Lng, db: Session = Depends(get_db)) -> str | None:
    lines = {s.id: s.geometry for s in db.scalars(select(Street)) if s.geometry}
    return geo.nearest((lat, lng), lines)


@router.post("/streets", response_model=StreetOut, status_code=status.HTTP_201_CREATED)
def create_street(body: StreetIn, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Street:
    s = Street(name_ru=body.name_ru, name_kk=body.name_kk)
    db.add(s)
    db.commit()
    return s


@router.patch("/streets/{street_id}", response_model=StreetOut)
def update_street(street_id: str, body: StreetIn, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Street:
    s = db.get(Street, street_id)
    if not s:
        raise ApiError(404, "not_found")
    s.name_ru, s.name_kk = body.name_ru, body.name_kk
    db.commit()
    return s


@router.delete("/streets/{street_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_street(street_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    s = db.get(Street, street_id)
    if not s:
        raise ApiError(404, "not_found")
    db.delete(s)  # у профилей и обращений street_id станет NULL (ON DELETE SET NULL)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
