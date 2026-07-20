import hmac
from base64 import urlsafe_b64encode
from hashlib import sha256
from urllib.parse import urlencode

from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppHTTPException, ErrorCode
from app.models import DisposalLocation


def create_signed_qr_token(bin_id: str, version: int) -> str:
    settings = get_settings()
    message = _qr_message(bin_id, version)
    signature = hmac.new(
        settings.qr_signing_secret.encode("utf-8"),
        message,
        sha256,
    ).digest()
    encoded_signature = urlsafe_b64encode(signature).decode("ascii").rstrip("=")
    return f"v{version}.{encoded_signature}"


def verify_signed_qr_token(bin_id: str, token: str, version: int) -> bool:
    expected_token = create_signed_qr_token(bin_id, version)
    return hmac.compare_digest(expected_token, token)


def assert_valid_signed_qr_token(
    location: DisposalLocation,
    token: str,
) -> None:
    if not verify_signed_qr_token(location.code, token, location.qr_secret_version):
        raise AppHTTPException(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.INVALID_QR,
            "QR 토큰이 유효하지 않습니다.",
        )


def build_qr_url(location: DisposalLocation) -> str:
    settings = get_settings()
    query = urlencode(
        {
            "bin_id": location.code,
            "token": create_signed_qr_token(
                location.code,
                location.qr_secret_version,
            ),
        }
    )
    return f"{settings.frontend_base_url.rstrip('/')}/verify?{query}"


def _qr_message(bin_id: str, version: int) -> bytes:
    return f"{bin_id}.{version}".encode()
