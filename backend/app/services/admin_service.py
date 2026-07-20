from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from fastapi import status
from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppHTTPException, ErrorCode
from app.models import (
    DisposalLocation,
    PointTransaction,
    PointTransactionType,
    Submission,
    SubmissionStatus,
    User,
)
from app.services.point_service import earn_transaction_exists


def get_submission_for_admin(db: Session, submission_id: int) -> Submission:
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise AppHTTPException(
            status.HTTP_404_NOT_FOUND,
            ErrorCode.SUBMISSION_NOT_FOUND,
            "제출 내역을 찾을 수 없습니다.",
        )
    return submission


def list_admin_submissions(
    db: Session,
    page: int,
    page_size: int,
    status_filter: SubmissionStatus | None = None,
    user_id: int | None = None,
    location_id: int | None = None,
    submitted_from: datetime | None = None,
    submitted_to: datetime | None = None,
) -> tuple[list[Submission], int]:
    query = select(Submission)
    if status_filter is not None:
        query = query.where(Submission.status == status_filter)
    if user_id is not None:
        query = query.where(Submission.user_id == user_id)
    if location_id is not None:
        query = query.where(Submission.location_id == location_id)
    if submitted_from is not None:
        query = query.where(Submission.submitted_at >= submitted_from)
    if submitted_to is not None:
        query = query.where(Submission.submitted_at <= submitted_to)
    return _paginate_admin_submissions(db, query, page, page_size)


def approve_submission(db: Session, submission_id: int, admin: User) -> Submission:
    settings = get_settings()
    submission = get_submission_for_admin(db, submission_id)

    if submission.status != SubmissionStatus.PENDING:
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.ALREADY_REVIEWED,
            "이미 검토가 완료된 제출입니다.",
        )

    if earn_transaction_exists(db, submission.id):
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.POINT_TRANSACTION_CONFLICT,
            "이미 마일리지가 적립된 제출입니다.",
        )

    submission.status = SubmissionStatus.APPROVED
    submission.reviewed_at = datetime.now(UTC)
    submission.reviewed_by = admin.id
    db.add(
        PointTransaction(
            user_id=submission.user_id,
            submission_id=submission.id,
            amount=settings.points_per_approval,
            transaction_type=PointTransactionType.EARN,
            description="분리배출 인증 승인",
        )
    )

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.POINT_TRANSACTION_CONFLICT,
            "마일리지 적립이 중복되었습니다.",
        ) from exc

    db.refresh(submission)
    return submission


def reject_submission(
    db: Session,
    submission_id: int,
    admin: User,
    reason: str,
) -> Submission:
    if not reason.strip():
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_REJECTION_REASON,
            "거절 사유는 공백일 수 없습니다.",
        )

    submission = get_submission_for_admin(db, submission_id)
    if submission.status != SubmissionStatus.PENDING:
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.ALREADY_REVIEWED,
            "이미 검토가 완료된 제출입니다.",
        )

    submission.status = SubmissionStatus.REJECTED
    submission.reviewed_at = datetime.now(UTC)
    submission.reviewed_by = admin.id
    submission.rejection_reason = reason.strip()
    db.commit()
    db.refresh(submission)
    return submission


def get_admin_statistics(db: Session) -> dict[str, object]:
    settings = get_settings()
    zone = ZoneInfo(settings.business_timezone)
    today = datetime.now(UTC).astimezone(zone).date()
    start = datetime.combine(today, time.min, tzinfo=zone).astimezone(UTC)
    end = datetime.combine(today, time.max, tzinfo=zone).astimezone(UTC)

    location_rows = db.execute(
        select(
            DisposalLocation.name,
            func.count(Submission.id),
        )
        .join(Submission, Submission.location_id == DisposalLocation.id, isouter=True)
        .group_by(DisposalLocation.id)
    ).all()

    total_points = (
        db.scalar(
            select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(
                PointTransaction.transaction_type == PointTransactionType.EARN
            )
        )
        or 0
    )

    return {
        "total_submissions": _count_submissions(db),
        "pending_submissions": _count_submissions(db, SubmissionStatus.PENDING),
        "approved_submissions": _count_submissions(db, SubmissionStatus.APPROVED),
        "rejected_submissions": _count_submissions(db, SubmissionStatus.REJECTED),
        "today_submissions": db.scalar(
            select(func.count())
            .select_from(Submission)
            .where(Submission.submitted_at >= start, Submission.submitted_at <= end)
        )
        or 0,
        "today_approved": db.scalar(
            select(func.count())
            .select_from(Submission)
            .where(
                Submission.status == SubmissionStatus.APPROVED,
                Submission.reviewed_at >= start,
                Submission.reviewed_at <= end,
            )
        )
        or 0,
        "active_users": db.scalar(
            select(func.count()).select_from(User).where(User.is_active.is_(True))
        )
        or 0,
        "total_points_awarded": int(total_points),
        "submissions_by_location": [
            {"location_name": name, "count": count} for name, count in location_rows
        ],
    }


def _count_submissions(
    db: Session,
    status_filter: SubmissionStatus | None = None,
) -> int:
    query = select(func.count()).select_from(Submission)
    if status_filter is not None:
        query = query.where(Submission.status == status_filter)
    return db.scalar(query) or 0


def _paginate_admin_submissions(
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
