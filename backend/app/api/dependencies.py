from collections.abc import Generator
from typing import Annotated

from fastapi import Depends, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppHTTPException, ErrorCode
from app.core.security import decode_access_token
from app.db.session import get_db as session_get_db
from app.models import User, UserRole


def get_app_settings() -> Settings:
    return get_settings()


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator[Session, None, None]:
    yield from session_get_db()


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    payload = decode_access_token(token)
    subject = payload.get("sub") if payload is not None else None
    if subject is None:
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_TOKEN,
            "유효하지 않은 인증 토큰입니다.",
        )

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_TOKEN,
            "유효하지 않은 인증 토큰입니다.",
        ) from exc

    user = db.get(User, user_id)
    if user is None:
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_TOKEN,
            "유효하지 않은 인증 토큰입니다.",
        )
    return user


def get_current_active_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not user.is_active:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.INACTIVE_USER,
            "비활성화된 사용자입니다.",
        )
    return user


def get_current_verified_user(
    user: Annotated[User, Depends(get_current_active_user)],
) -> User:
    if user.email_verified_at is None:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.EMAIL_NOT_VERIFIED,
            "이메일 인증이 필요합니다.",
        )
    return user


def get_current_admin(
    user: Annotated[User, Depends(get_current_verified_user)],
) -> User:
    if user.role != UserRole.ADMIN:
        raise AppHTTPException(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.ADMIN_REQUIRED,
            "관리자 권한이 필요합니다.",
        )
    return user
