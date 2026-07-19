from decimal import Decimal, InvalidOperation

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import DisposalLocation, User, UserRole


def _parse_decimal(value: str, field_name: str) -> Decimal:
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} must be a decimal value.") from exc


def seed_admin() -> None:
    settings = get_settings()
    if not settings.seed_admin_email or not settings.seed_admin_password:
        print("Admin seed skipped: SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is empty.")
        return

    email = settings.seed_admin_email.lower()
    with SessionLocal() as db:
        existing_user = db.scalar(select(User).where(User.email == email))
        if existing_user is not None:
            print(f"Admin seed skipped: user already exists ({email}).")
            return

        existing_student_number = db.scalar(
            select(User).where(
                User.student_number == settings.seed_admin_student_number,
            )
        )
        if existing_student_number is not None:
            print("Admin seed skipped: student number already exists.")
            return

        admin = User(
            email=email,
            student_number=settings.seed_admin_student_number,
            name=settings.seed_admin_name,
            hashed_password=hash_password(settings.seed_admin_password),
            role=UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Admin seed created: {email}")


def seed_location() -> None:
    settings = get_settings()
    if not settings.seed_location_latitude or not settings.seed_location_longitude:
        print("Location seed skipped: latitude or longitude is empty.")
        return

    with SessionLocal() as db:
        existing_location = db.scalar(
            select(DisposalLocation).where(
                DisposalLocation.name == settings.seed_location_name,
            )
        )
        if existing_location is not None:
            print(f"Location seed skipped: {existing_location.qr_token}")
            return

        location = DisposalLocation(
            name=settings.seed_location_name,
            description=settings.seed_location_description,
            latitude=_parse_decimal(
                settings.seed_location_latitude,
                "SEED_LOCATION_LATITUDE",
            ),
            longitude=_parse_decimal(
                settings.seed_location_longitude,
                "SEED_LOCATION_LONGITUDE",
            ),
            allowed_radius_m=settings.seed_location_allowed_radius_m,
            is_active=True,
        )
        db.add(location)
        db.commit()
        db.refresh(location)
        print(f"Location seed created: {location.qr_token}")


def main() -> None:
    seed_admin()
    seed_location()


if __name__ == "__main__":
    main()
