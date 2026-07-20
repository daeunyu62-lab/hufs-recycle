import smtplib
from email.message import EmailMessage

from app.core.config import get_settings
from app.core.errors import AppError


class EmailDeliveryError(AppError):
    pass


def send_verification_email(email: str, token: str) -> bool:
    settings = get_settings()
    if settings.email_verification_mode == "development":
        return False
    if settings.email_verification_mode != "smtp":
        raise EmailDeliveryError("Unsupported email verification mode.")
    if not settings.smtp_host or not settings.email_from:
        raise EmailDeliveryError("SMTP settings are incomplete.")

    verify_url = _build_verify_url(token)
    message = EmailMessage()
    message["Subject"] = "[HUFS Recycle] 이메일 인증"
    message["From"] = settings.email_from
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "HUFS Recycle 이메일 인증 링크입니다.",
                "",
                verify_url,
                "",
                "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
            ]
        )
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except OSError as exc:
        raise EmailDeliveryError("Failed to send verification email.") from exc

    return True


def _build_verify_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.frontend_base_url.rstrip('/')}/verify-email?token={token}"
