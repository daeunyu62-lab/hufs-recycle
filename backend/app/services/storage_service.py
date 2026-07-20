from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.utils.files import extension_for_mime_type


@dataclass(frozen=True)
class StoredFile:
    path: str


class StorageService:
    def save_submission_photo(
        self,
        user_id: int,
        content: bytes,
        content_type: str,
    ) -> StoredFile:
        raise NotImplementedError

    def delete(self, path: str) -> None:
        raise NotImplementedError

    def create_signed_url(self, path: str) -> str | None:
        raise NotImplementedError


class LocalStorageService(StorageService):
    def __init__(self, settings: Settings) -> None:
        self.upload_dir = Path(settings.local_upload_dir)

    def save_submission_photo(
        self,
        user_id: int,
        content: bytes,
        content_type: str,
    ) -> StoredFile:
        extension = extension_for_mime_type(content_type)
        if extension is None:
            raise AppError("Unsupported image MIME type.")

        now = datetime.now(UTC)
        relative_path = Path("submissions") / str(user_id) / str(now.year)
        relative_path = relative_path / f"{now.month:02d}" / f"{now.day:02d}"
        relative_path = relative_path / f"{uuid4()}{extension}"
        full_path = self.upload_dir / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        return StoredFile(path=relative_path.as_posix())

    def delete(self, path: str) -> None:
        file_path = self.upload_dir / path
        if file_path.exists():
            file_path.unlink()

    def create_signed_url(self, path: str) -> str | None:
        return f"/uploads/{path}"


class SupabaseStorageService(StorageService):
    def __init__(self, settings: Settings) -> None:
        from supabase import create_client

        self.bucket = settings.supabase_storage_bucket
        self.expires_in = settings.signed_image_url_expire_seconds
        self.client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def save_submission_photo(
        self,
        user_id: int,
        content: bytes,
        content_type: str,
    ) -> StoredFile:
        extension = extension_for_mime_type(content_type)
        if extension is None:
            raise AppError("Unsupported image MIME type.")

        now = datetime.now(UTC)
        path = (
            f"submissions/{user_id}/{now.year}/{now.month:02d}/"
            f"{now.day:02d}/{uuid4()}{extension}"
        )
        self.client.storage.from_(self.bucket).upload(
            path,
            content,
            file_options={"content-type": content_type, "upsert": "false"},
        )
        return StoredFile(path=path)

    def delete(self, path: str) -> None:
        self.client.storage.from_(self.bucket).remove([path])

    def create_signed_url(self, path: str) -> str | None:
        response = self.client.storage.from_(self.bucket).create_signed_url(
            path,
            self.expires_in,
        )
        return response.get("signedURL") or response.get("signed_url")


def get_storage_service() -> StorageService:
    settings = get_settings()
    if settings.storage_backend == "supabase":
        return SupabaseStorageService(settings)
    return LocalStorageService(settings)
