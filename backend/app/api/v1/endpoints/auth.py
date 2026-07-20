from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResendVerificationResponse,
    TokenResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.services.auth_service import (
    login_user,
    register_user,
    resend_email_verification,
    verify_user_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    request: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
) -> RegisterResponse:
    return register_user(db, request)


@router.post("/verify-email", response_model=VerifyEmailResponse)
def verify_email(
    request: VerifyEmailRequest,
    db: Annotated[Session, Depends(get_db)],
) -> VerifyEmailResponse:
    verify_user_email(db, request.token)
    return VerifyEmailResponse(status="ok", message="이메일 인증이 완료되었습니다.")


@router.post(
    "/resend-verification",
    response_model=ResendVerificationResponse,
)
def resend_verification(
    request: ResendVerificationRequest,
    db: Annotated[Session, Depends(get_db)],
) -> ResendVerificationResponse:
    return resend_email_verification(db, request.email)


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    return login_user(db, request.email, request.password)
