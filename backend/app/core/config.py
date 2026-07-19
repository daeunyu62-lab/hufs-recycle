from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def parse_allowed_origins(value: str | list[str]) -> list[str]:
    if isinstance(value, str):
        return [origin.strip() for origin in value.split(",") if origin.strip()]
    return value


AllowedOrigins = Annotated[
    list[str],
    NoDecode,
    BeforeValidator(parse_allowed_origins),
]


class Settings(BaseSettings):
    app_name: str = "HUFS Recycle API"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    business_timezone: str = "Asia/Seoul"

    database_url: str = "sqlite:///./dev.db"

    jwt_secret_key: str = "replace-with-a-long-random-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 120

    allowed_origins: AllowedOrigins = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    daily_submission_limit: int = 2
    submission_cooldown_minutes: int = 60
    points_per_approval: int = 1
    default_allowed_radius_m: int = 30
    max_gps_accuracy_m: int = 100
    max_image_size_mb: int = 5
    signed_image_url_expire_seconds: int = 300

    storage_backend: str = "local"
    local_upload_dir: str = "uploads"

    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "submission-images"

    seed_admin_email: str = ""
    seed_admin_password: str = ""
    seed_admin_name: str = "관리자"
    seed_admin_student_number: str = "ADMIN001"

    seed_location_name: str = "교내 테스트 분리수거함"
    seed_location_description: str = "개발 테스트 장소"
    seed_location_latitude: str = ""
    seed_location_longitude: str = ""
    seed_location_allowed_radius_m: int = 30

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.app_env.lower() not in {"production", "prod"}:
            return self

        if self.database_url.startswith("sqlite"):
            raise ValueError("SQLite cannot be used in production.")
        if self.storage_backend == "local":
            raise ValueError("Local storage cannot be used in production.")
        if self.storage_backend == "supabase":
            missing_supabase_values = [
                name
                for name, value in {
                    "SUPABASE_URL": self.supabase_url,
                    "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
                    "SUPABASE_STORAGE_BUCKET": self.supabase_storage_bucket,
                }.items()
                if not value
            ]
            if missing_supabase_values:
                joined_names = ", ".join(missing_supabase_values)
                raise ValueError(
                    f"Missing production Supabase settings: {joined_names}"
                )

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
