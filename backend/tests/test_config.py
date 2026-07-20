import pytest
from app.core.config import Settings
from pydantic import ValidationError


def test_production_rejects_demo_auto_approval() -> None:
    with pytest.raises(ValidationError, match="Demo auto approval"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://user:password@db.example/test",
            jwt_secret_key="production-jwt-secret-with-enough-length",
            qr_signing_secret="production-qr-secret-with-enough-length",
            storage_backend="supabase",
            supabase_url="https://project.example",
            supabase_service_role_key="test-service-role-key",
            supabase_storage_bucket="submission-images",
            demo_auto_approve_submissions=True,
        )
