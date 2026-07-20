from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.location import LocationPublic, QrVerifyResponse
from app.services.location_service import (
    get_location_by_code,
    get_location_by_qr_token,
    verify_qr_location_proximity,
)

router = APIRouter(tags=["locations"])


@router.get("/locations/{qr_token}", response_model=LocationPublic)
def read_location_by_qr_token(
    qr_token: str,
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return get_location_by_qr_token(db, qr_token)


@router.get("/trash-bins/{bin_id}", response_model=LocationPublic)
def read_trash_bin_by_code(
    bin_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> object:
    return get_location_by_code(db, bin_id)


@router.get("/qr/verify", response_model=QrVerifyResponse)
def verify_qr_token_and_location(
    db: Annotated[Session, Depends(get_db)],
    bin_id: Annotated[str, Query(min_length=3)],
    token: Annotated[str, Query(min_length=10)],
    latitude: Annotated[float, Query(ge=-90, le=90)],
    longitude: Annotated[float, Query(ge=-180, le=180)],
    accuracy_m: Annotated[float, Query(gt=0)],
) -> QrVerifyResponse:
    return verify_qr_location_proximity(
        db=db,
        bin_id=bin_id,
        token=token,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
    )
