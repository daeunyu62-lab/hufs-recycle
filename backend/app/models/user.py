from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import UserRole
from app.models.mixins import TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    student_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    hashed_password: Mapped[str] = mapped_column(String(255))
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_verification_token_hash: Mapped[str | None] = mapped_column(String(64))
    mileage_balance: Mapped[int] = mapped_column(default=0, nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        default=UserRole.USER,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    submissions = relationship(
        "Submission",
        back_populates="user",
        foreign_keys="Submission.user_id",
    )
    reviewed_submissions = relationship(
        "Submission",
        back_populates="reviewer",
        foreign_keys="Submission.reviewed_by",
    )
    point_transactions = relationship(
        "PointTransaction",
        back_populates="user",
    )
