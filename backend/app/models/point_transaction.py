from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PointTransactionType
from app.models.mixins import utc_now


class PointTransaction(Base):
    __tablename__ = "point_transactions"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "transaction_type",
            name="uq_point_transactions_submission_transaction_type",
        ),
        Index("ix_point_transactions_user_created_at", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"))
    amount: Mapped[int] = mapped_column(nullable=False)
    transaction_type: Mapped[PointTransactionType] = mapped_column(
        Enum(PointTransactionType, name="point_transaction_type"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )

    user = relationship("User", back_populates="point_transactions")
    submission = relationship("Submission", back_populates="point_transactions")
