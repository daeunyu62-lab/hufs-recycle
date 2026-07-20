from datetime import UTC, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import UploadFile, status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError, AppHTTPException, ErrorCode
from app.models import (
    PointTransaction,
    PointTransactionType,
    Submission,
    SubmissionStatus,
    User,
)
from app.services.location_service import (
    get_location_by_qr_token,
    get_location_by_signed_qr,
)
from app.services.storage_service import get_storage_service
from app.utils.distance import haversine_distance_m
from app.utils.files import extension_for_mime_type, is_valid_image_content

VALID_LIMIT_STATUSES = (SubmissionStatus.PENDING, SubmissionStatus.APPROVED)


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _today_bounds_utc(now_utc: datetime) -> tuple[datetime, datetime]:
    settings = get_settings()
    zone = ZoneInfo(settings.business_timezone)
    today = now_utc.astimezone(zone).date()
    start = datetime.combine(today, time.min, tzinfo=zone).astimezone(UTC)
    end = start + timedelta(days=1)
    return start, end


def _validate_coordinates(latitude: float, longitude: float, accuracy_m: float) -> None:
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


def _validate_gps_accuracy(accuracy_m: float) -> None:
    settings = get_settings()
    if accuracy_m > settings.max_gps_accuracy_m:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.GPS_ACCURACY_TOO_LOW,
            "GPS 정확도가 낮아 인증할 수 없습니다.",
            {
                "accuracy_m": accuracy_m,
                "max_gps_accuracy_m": settings.max_gps_accuracy_m,
            },
        )


def _today_submission_count(db: Session, user_id: int, now_utc: datetime) -> int:
    start, end = _today_bounds_utc(now_utc)
    return (
        db.scalar(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.user_id == user_id,
                Submission.status.in_(VALID_LIMIT_STATUSES),
                Submission.submitted_at >= start,
                Submission.submitted_at < end,
            )
        )
        or 0
    )


def _latest_valid_submission(db: Session, user_id: int) -> Submission | None:
    return db.scalar(
        select(Submission)
        .where(
            Submission.user_id == user_id,
            Submission.status.in_(VALID_LIMIT_STATUSES),
        )
        .order_by(Submission.submitted_at.desc())
        .limit(1)
    )


async def create_submission(
    db: Session,
    user: User,
    qr_token: str | None,
    bin_id: str | None,
    token: str | None,
    latitude: float,
    longitude: float,
    accuracy_m: float,
    photo: UploadFile,
) -> dict[str, object]:
    settings = get_settings()
    now_utc = datetime.now(UTC)

    user = db.execute(
        select(User).where(User.id == user.id).with_for_update()
    ).scalar_one()

    if bin_id and token:
        location = get_location_by_signed_qr(db, bin_id, token)
    elif qr_token:
        location = get_location_by_qr_token(db, qr_token)
    else:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_QR,
            "QR 토큰 또는 쓰레기통 ID와 서명 토큰이 필요합니다.",
        )

    _validate_coordinates(latitude, longitude, accuracy_m)
    _validate_gps_accuracy(accuracy_m)

    distance_m = haversine_distance_m(
        float(location.latitude),
        float(location.longitude),
        latitude,
        longitude,
    )
    if distance_m > location.allowed_radius_m:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.LOCATION_TOO_FAR,
            "지정된 분리수거함에서 너무 멀리 떨어져 있습니다.",
            {
                "distance_m": round(distance_m, 2),
                "allowed_radius_m": location.allowed_radius_m,
            },
        )

    today_count = _today_submission_count(db, user.id, now_utc)
    if today_count >= settings.daily_submission_limit:
        raise AppHTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            ErrorCode.DAILY_LIMIT,
            "오늘 제출 가능한 횟수를 모두 사용했습니다.",
            {"daily_submission_limit": settings.daily_submission_limit},
        )

    latest_submission = _latest_valid_submission(db, user.id)
    if latest_submission is not None:
        elapsed = now_utc - _as_aware_utc(latest_submission.submitted_at)
        cooldown = timedelta(minutes=settings.submission_cooldown_minutes)
        if elapsed < cooldown:
            retry_after_seconds = int((cooldown - elapsed).total_seconds())
            raise AppHTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                ErrorCode.HOURLY_LIMIT,
                "최근 제출 후 60분이 지나야 다시 제출할 수 있습니다.",
                {"retry_after_seconds": retry_after_seconds},
            )

    content_type = photo.content_type or ""
    if extension_for_mime_type(content_type) is None:
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_IMAGE,
            "jpg, png, webp 이미지만 제출할 수 있습니다.",
        )

    content = await photo.read()
    max_bytes = settings.max_image_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise AppHTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            ErrorCode.IMAGE_TOO_LARGE,
            "이미지 용량이 허용 크기를 초과했습니다.",
            {"max_image_size_mb": settings.max_image_size_mb},
        )

    if not is_valid_image_content(content_type, content):
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_IMAGE,
            "이미지 파일 내용이 MIME 타입과 일치하지 않습니다.",
        )

    storage = get_storage_service()
    try:
        stored_file = storage.save_submission_photo(user.id, content, content_type)
    except AppError as exc:
        raise AppHTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            ErrorCode.STORAGE_ERROR,
            "이미지 저장에 실패했습니다.",
        ) from exc

    submission = Submission(
        user_id=user.id,
        location_id=location.id,
        image_path=stored_file.path,
        latitude=Decimal(str(latitude)),
        longitude=Decimal(str(longitude)),
        accuracy_m=Decimal(str(accuracy_m)),
        distance_m=Decimal(str(round(distance_m, 2))),
        status=SubmissionStatus.PENDING,
        submitted_at=now_utc,
    )
    points_awarded = 0
    try:
        db.add(submission)
        db.flush()
        if settings.demo_auto_approve_submissions:
            points_awarded = settings.points_per_approval
            submission.status = SubmissionStatus.APPROVED
            submission.reviewed_at = now_utc
            user.mileage_balance += points_awarded
            db.add(
                PointTransaction(
                    user_id=user.id,
                    submission_id=submission.id,
                    amount=points_awarded,
                    transaction_type=PointTransactionType.EARN,
                    description="분리배출 인증 데모 자동 승인",
                )
            )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        storage.delete(stored_file.path)
        raise

    db.refresh(submission)
    remaining_today = settings.daily_submission_limit - today_count - 1
    return {
        "submission_id": submission.id,
        "status": submission.status,
        "distance_m": round(distance_m, 2),
        "remaining_today": remaining_today,
        "points_awarded": points_awarded,
        "mileage_balance": user.mileage_balance,
        "message": (
            f"인증이 승인되어 마일리지 {points_awarded}점이 적립되었습니다."
            if points_awarded
            else "인증이 제출되었습니다. 관리자 검토 후 마일리지가 적립됩니다."
        ),
    }


def get_submission_for_user(
    db: Session,
    submission_id: int,
    user: User,
) -> Submission:
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.SUBMISSION_NOT_FOUND,
            "제출 내역을 찾을 수 없습니다.",
        )
    if submission.user_id != user.id:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.FORBIDDEN_SUBMISSION_ACCESS,
            "다른 사용자의 제출 내역은 조회할 수 없습니다.",
        )
    return submission


def list_user_submissions(
    db: Session,
    user_id: int,
    page: int,
    page_size: int,
) -> tuple[list[Submission], int]:
    query = select(Submission).where(Submission.user_id == user_id)
    return _paginate_submissions(db, query, page, page_size)


def get_submission_eligibility(
    db: Session,
    user_id: int,
) -> dict[str, object]:
    settings = get_settings()
    now_utc = datetime.now(UTC)
    used_today = _today_submission_count(db, user_id, now_utc)
    remaining_today = max(settings.daily_submission_limit - used_today, 0)
    latest_submission = _latest_valid_submission(db, user_id)

    next_submission_at = None
    if latest_submission is not None:
        cooldown = timedelta(minutes=settings.submission_cooldown_minutes)
        candidate = _as_aware_utc(latest_submission.submitted_at) + cooldown
        if candidate > now_utc:
            next_submission_at = candidate

    return {
        "daily_limit": settings.daily_submission_limit,
        "used_today": used_today,
        "remaining_today": remaining_today,
        "cooldown_minutes": settings.submission_cooldown_minutes,
        "next_submission_at": next_submission_at,
        "can_submit_now": remaining_today > 0 and next_submission_at is None,
    }


def _paginate_submissions(
    db: Session,
    query: Select[tuple[Submission]],
    page: int,
    page_size: int,
) -> tuple[list[Submission], int]:
    total = (
        db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
        or 0
    )
    items = list(
        db.scalars(
            query.order_by(Submission.submitted_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return items, total
