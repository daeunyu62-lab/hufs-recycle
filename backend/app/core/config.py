from functools import lru_cache
from typing import Annotated

from pydantic import BeforeValidator, Field
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
    app_name: str = "HUFS Eco Mileage API"
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

