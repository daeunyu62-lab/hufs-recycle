from decimal import Decimal

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppHTTPException, ErrorCode
from app.models import DisposalLocation
from app.schemas.location import (
    AdminLocationCreate,
    AdminLocationPublic,
    AdminLocationUpdate,
    QrVerifyResponse,
)
from app.services.qr_service import assert_valid_signed_qr_token, build_qr_url
from app.utils.distance import haversine_distance_m


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


def get_location_by_code(
    db: Session,
    bin_id: str,
    *,
    require_active: bool = True,
) -> DisposalLocation:
    location = db.scalar(
        select(DisposalLocation).where(DisposalLocation.code == bin_id)
    )
    if location is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.INVALID_QR,
            "존재하지 않는 쓰레기통 ID입니다.",
        )
    if require_active and not location.is_active:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.BIN_INACTIVE,
            "비활성화된 분리수거함입니다.",
        )
    return location


def get_location_by_id(db: Session, location_id: int) -> DisposalLocation:
    location = db.get(DisposalLocation, location_id)
    if location is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.INVALID_QR,
            "분리수거함을 찾을 수 없습니다.",
        )
    return location


def get_location_by_signed_qr(
    db: Session,
    bin_id: str,
    token: str,
) -> DisposalLocation:
    location = get_location_by_code(db, bin_id)
    assert_valid_signed_qr_token(location, token)
    return location


def list_locations(db: Session) -> list[DisposalLocation]:
    return list(db.scalars(select(DisposalLocation).order_by(DisposalLocation.id)))


def serialize_admin_location(location: DisposalLocation) -> AdminLocationPublic:
    return AdminLocationPublic.model_validate(location).model_copy(
        update={"qr_url": build_qr_url(location)}
    )


def create_location(
    db: Session,
    request: AdminLocationCreate,
) -> DisposalLocation:
    if request.code and _location_code_exists(db, request.code):
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.BIN_CODE_ALREADY_EXISTS,
            "이미 사용 중인 쓰레기통 ID입니다.",
        )

    location_data = {
        "name": request.name,
        "description": request.description,
        "latitude": Decimal(str(request.latitude)),
        "longitude": Decimal(str(request.longitude)),
        "allowed_radius_m": request.allowed_radius_m,
        "is_active": request.is_active,
    }
    if request.code:
        location_data["code"] = request.code

    location = DisposalLocation(**location_data)
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
    if (
        request.code
        and request.code != location.code
        and _location_code_exists(
            db,
            request.code,
        )
    ):
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.BIN_CODE_ALREADY_EXISTS,
            "이미 사용 중인 쓰레기통 ID입니다.",
        )

    for key, value in update_data.items():
        if key in {"latitude", "longitude"} and value is not None:
            value = Decimal(str(value))
        setattr(location, key, value)

    db.commit()
    db.refresh(location)
    return location


def verify_qr_location_proximity(
    db: Session,
    bin_id: str,
    token: str,
    latitude: float,
    longitude: float,
    accuracy_m: float,
) -> QrVerifyResponse:
    settings = get_settings()
    location = get_location_by_signed_qr(db, bin_id, token)
    if not -90 <= latitude <= 90:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_COORDINATES,
            "위도 값이 허용 범위를 벗어났습니다.",
        )
    if not -180 <= longitude <= 180:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_COORDINATES,
            "경도 값이 허용 범위를 벗어났습니다.",
        )
    if accuracy_m <= 0:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_COORDINATES,
            "GPS 정확도는 0보다 커야 합니다.",
        )
    if accuracy_m > settings.max_gps_accuracy_m:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.GPS_ACCURACY_TOO_LOW,
            "GPS 정확도가 낮아 촬영할 수 없습니다.",
            {
                "accuracy_m": accuracy_m,
                "max_gps_accuracy_m": settings.max_gps_accuracy_m,
            },
        )

    distance_m = haversine_distance_m(
        float(location.latitude),
        float(location.longitude),
        latitude,
        longitude,
    )
    return QrVerifyResponse(
        bin=location,
        distance_m=round(distance_m, 2),
        allowed_radius_m=location.allowed_radius_m,
        gps_accuracy_m=accuracy_m,
        can_take_photo=distance_m <= location.allowed_radius_m,
    )


def _location_code_exists(db: Session, code: str) -> bool:
    return (
        db.scalar(select(DisposalLocation.id).where(DisposalLocation.code == code))
        is not None
    )
