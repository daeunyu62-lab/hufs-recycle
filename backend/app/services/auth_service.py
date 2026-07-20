import secrets
from datetime import UTC, datetime

from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppHTTPException, ErrorCode
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models import User, UserRole
from app.schemas.auth import RegisterRequest, RegisterResponse, TokenResponse


def _is_allowed_email_domain(email: str, settings: Settings) -> bool:
    domain = email.rsplit("@", 1)[-1]
    return domain in {allowed.lower() for allowed in settings.allowed_email_domains}


def _user_auth_response(user: User) -> dict[str, object]:
    return {
        "id": user.id,
        "email": user.email,
        "student_number": user.student_number,
        "name": user.name,
        "role": user.role,
        "is_active": user.is_active,
        "is_email_verified": user.email_verified_at is not None,
    }


def register_user(db: Session, request: RegisterRequest) -> RegisterResponse:
    settings = get_settings()
    email = request.email.lower()

    if not _is_allowed_email_domain(email, settings):
        raise AppHTTPException(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.INVALID_EMAIL_DOMAIN,
            "외대 이메일 주소만 가입할 수 있습니다.",
            {"allowed_domains": settings.allowed_email_domains},
        )

    if db.scalar(select(User).where(User.email == email)) is not None:
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.EMAIL_ALREADY_EXISTS,
            "이미 가입된 이메일입니다.",
        )

    if (
        db.scalar(select(User).where(User.student_number == request.student_number))
        is not None
    ):
        raise AppHTTPException(
            status.HTTP_409_CONFLICT,
            ErrorCode.STUDENT_NUMBER_ALREADY_EXISTS,
            "이미 가입된 학번입니다.",
        )

    verification_token = secrets.token_urlsafe(32)
    user = User(
        email=email,
        student_number=request.student_number,
        name=request.name,
        hashed_password=hash_password(request.password),
        email_verification_token_hash=hash_token(verification_token),
        role=UserRole.USER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    show_token = settings.app_env.lower() in {"development", "test"}
    return RegisterResponse(
        user=_user_auth_response(user),
        email_verification_required=True,
        email_verification_token=verification_token if show_token else None,
    )


def verify_user_email(db: Session, token: str) -> None:
    token_hash = hash_token(token)
    user = db.scalar(
        select(User).where(User.email_verification_token_hash == token_hash)
    )
    if user is None:
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_TOKEN,
            "유효하지 않은 이메일 인증 토큰입니다.",
        )

    user.email_verified_at = datetime.now(UTC)
    user.email_verification_token_hash = None
    db.commit()


def login_user(db: Session, email: str, password: str) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == email.lower()))
    if user is None or not verify_password(password, user.hashed_password):
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_CREDENTIALS,
            "이메일 또는 비밀번호가 올바르지 않습니다.",
        )

    if not user.is_active:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.INACTIVE_USER,
            "비활성화된 사용자입니다.",
        )

    if user.email_verified_at is None:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.EMAIL_NOT_VERIFIED,
            "이메일 인증 후 로그인할 수 있습니다.",
        )

    return TokenResponse(access_token=create_access_token(user.id))
