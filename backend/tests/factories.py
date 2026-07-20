from datetime import UTC, datetime
from decimal import Decimal

from app.core.security import create_access_token, hash_password
from app.models import DisposalLocation, Submission, SubmissionStatus, User, UserRole
from app.services.qr_service import create_signed_qr_token
from sqlalchemy.orm import Session


def auth_headers(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def png_upload() -> tuple[str, bytes, str]:
    return ("photo.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 16, "image/png")


def create_user(
    db: Session,
    *,
    email: str = "student@hufs.ac.kr",
    student_number: str = "202400001",
    name: str = "테스트 사용자",
    password: str = "password123!",
    role: UserRole = UserRole.USER,
    verified: bool = True,
) -> User:
    user = User(
        email=email,
        student_number=student_number,
        name=name,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
        email_verified_at=datetime.now(UTC) if verified else None,
        email_verification_token_hash=None if verified else "pending-token-hash",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_location(
    db: Session,
    *,
    name: str = "테스트 분리수거함",
    code: str = "HUFS-001",
    qr_token: str = "test-qr-token",
    latitude: float = 37.597,
    longitude: float = 127.058,
    allowed_radius_m: int = 30,
    is_active: bool = True,
) -> DisposalLocation:
    location = DisposalLocation(
        code=code,
        name=name,
        description="테스트 장소",
        latitude=Decimal(str(latitude)),
        longitude=Decimal(str(longitude)),
        allowed_radius_m=allowed_radius_m,
        qr_token=qr_token,
        is_active=is_active,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def signed_qr_payload(location: DisposalLocation) -> dict[str, str]:
    return {
        "bin_id": location.code,
        "token": create_signed_qr_token(
            location.code,
            location.qr_secret_version,
        ),
    }


def create_submission(
    db: Session,
    *,
    user_id: int,
    location_id: int,
    status: SubmissionStatus = SubmissionStatus.PENDING,
    submitted_at: datetime | None = None,
    image_path: str = "submissions/test.png",
) -> Submission:
    submission = Submission(
        user_id=user_id,
        location_id=location_id,
        image_path=image_path,
        latitude=Decimal("37.597000"),
        longitude=Decimal("127.058000"),
        accuracy_m=Decimal("10.00"),
        distance_m=Decimal("0.00"),
        status=status,
        submitted_at=submitted_at or datetime.now(UTC),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission
