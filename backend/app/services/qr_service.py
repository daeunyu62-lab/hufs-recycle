import hmac
from base64 import urlsafe_b64encode
from hashlib import sha256
from io import BytesIO
from urllib.parse import urlencode

import qrcode
from fastapi import status
from qrcode.constants import ERROR_CORRECT_M

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


def create_qr_png(qr_url: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)

    image = qr.make_image(fill_color="black", back_color="white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _qr_message(bin_id: str, version: int) -> bytes:
    return f"{bin_id}.{version}".encode()
