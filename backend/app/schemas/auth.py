from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import UserRole


class RegisterRequest(BaseModel):
    email: str
    student_number: str = Field(min_length=3, max_length=50)
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(extra="forbid")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        email = value.strip().lower()
        if "@" not in email:
            raise ValueError("email must be valid")
        return email


class UserAuthResponse(BaseModel):
    id: int
    email: str
    student_number: str
    name: str
    role: UserRole
    is_active: bool
    mileage_balance: int
    is_email_verified: bool

    model_config = ConfigDict(from_attributes=True)


class RegisterResponse(BaseModel):
    user: UserAuthResponse
    email_verification_required: bool
    email_verification_token: str | None = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=16)


class VerifyEmailResponse(BaseModel):
    status: str
    message: str


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
