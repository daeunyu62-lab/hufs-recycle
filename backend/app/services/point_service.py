from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import PointTransaction, PointTransactionType, User


def get_user_point_balance(db: Session, user_id: int) -> int:
    user = db.get(User, user_id)
    if user is not None:
        return user.mileage_balance

    return _sum_user_point_transactions(db, user_id)


def _sum_user_point_transactions(db: Session, user_id: int) -> int:
    return (
        db.scalar(
            select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(
                PointTransaction.user_id == user_id
            )
        )
        or 0
    )


def list_user_point_transactions(
    db: Session,
    user_id: int,
    page: int,
    page_size: int,
) -> tuple[list[PointTransaction], int]:
    query = select(PointTransaction).where(PointTransaction.user_id == user_id)
    total = (
        db.scalar(select(func.count()).select_from(query.order_by(None).subquery()))
        or 0
    )
    items = list(
        db.scalars(
            query.order_by(PointTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return items, total


def earn_transaction_exists(db: Session, submission_id: int) -> bool:
    return (
        db.scalar(
            select(PointTransaction.id).where(
                PointTransaction.submission_id == submission_id,
                PointTransaction.transaction_type == PointTransactionType.EARN,
            )
        )
        is not None
    )
