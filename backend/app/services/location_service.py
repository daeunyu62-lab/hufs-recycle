from decimal import Decimal

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppHTTPException, ErrorCode
from app.models import DisposalLocation
from app.schemas.location import AdminLocationCreate, AdminLocationUpdate


def get_location_by_qr_token(db: Session, qr_token: str) -> DisposalLocation:
    location = db.scalar(
        select(DisposalLocation).where(DisposalLocation.qr_token == qr_token)
    )
    if location is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.INVALID_QR_TOKEN,
            "존재하지 않는 QR 토큰입니다.",
        )
    if not location.is_active:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INACTIVE_LOCATION,
            "비활성화된 분리수거함입니다.",
        )
    return location


def list_locations(db: Session) -> list[DisposalLocation]:
    return list(db.scalars(select(DisposalLocation).order_by(DisposalLocation.id)))


def create_location(
    db: Session,
    request: AdminLocationCreate,
) -> DisposalLocation:
    location = DisposalLocation(
        name=request.name,
        description=request.description,
        latitude=Decimal(str(request.latitude)),
        longitude=Decimal(str(request.longitude)),
        allowed_radius_m=request.allowed_radius_m,
        is_active=request.is_active,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def update_location(
    db: Session,
    location_id: int,
    request: AdminLocationUpdate,
) -> DisposalLocation:
    location = db.get(DisposalLocation, location_id)
    if location is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.INVALID_QR_TOKEN,
            "분리수거함을 찾을 수 없습니다.",
        )

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key in {"latitude", "longitude"} and value is not None:
            value = Decimal(str(value))
        setattr(location, key, value)

    db.commit()
    db.refresh(location)
    return location
