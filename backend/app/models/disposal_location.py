from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin


def _create_bin_code() -> str:
    return f"HUFS-{uuid4().hex[:8].upper()}"


class DisposalLocation(TimestampMixin, Base):
    __tablename__ = "disposal_locations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(
        String(50),
        default=_create_bin_code,
        unique=True,
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6))
    allowed_radius_m: Mapped[int] = mapped_column(default=30, nullable=False)
    qr_token: Mapped[str] = mapped_column(
        String(36),
        default=lambda: str(uuid4()),
        unique=True,
        index=True,
        nullable=False,
    )
    qr_secret_version: Mapped[int] = mapped_column(default=1, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        index=True,
        nullable=False,
    )

    submissions = relationship("Submission", back_populates="location")
