from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import SubmissionStatus
from app.models.mixins import TimestampMixin, utc_now


class Submission(TimestampMixin, Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index(
            "ix_submissions_user_status_submitted_at",
            "user_id",
            "status",
            "submitted_at",
        ),
        Index("ix_submissions_location_status", "location_id", "status"),
        Index("ix_submissions_submitted_at", "submitted_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    location_id: Mapped[int] = mapped_column(
        ForeignKey("disposal_locations.id"),
        nullable=False,
    )
    image_path: Mapped[str] = mapped_column(String(500))
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    accuracy_m: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    distance_m: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus, name="submission_status"),
        default=SubmissionStatus.PENDING,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    user = relationship(
        "User",
        back_populates="submissions",
        foreign_keys=[user_id],
    )
    reviewer = relationship(
        "User",
        back_populates="reviewed_submissions",
        foreign_keys=[reviewed_by],
    )
    location = relationship("DisposalLocation", back_populates="submissions")
    point_transactions = relationship("PointTransaction", back_populates="submission")
