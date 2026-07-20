from datetime import UTC, datetime

import pytest
from app.core.config import get_settings
from app.models import PointTransaction, Submission, SubmissionStatus, User
from app.services.qr_service import create_signed_qr_token
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.factories import (
    auth_headers,
    create_location,
    create_submission,
    create_user,
    png_upload,
)


def _post_submission(
    client: TestClient,
    *,
    user_id: int,
    bin_id: str = "HUFS-001",
    token: str | None = None,
    qr_token: str | None = None,
    latitude: float = 37.597,
    longitude: float = 127.058,
    accuracy_m: float = 10,
    upload: tuple[str, bytes, str] | None = None,
):
    form_data = {
        "latitude": str(latitude),
        "longitude": str(longitude),
        "accuracy_m": str(accuracy_m),
    }
    if qr_token is not None:
        form_data["qr_token"] = qr_token
    else:
        form_data["bin_id"] = bin_id
        form_data["token"] = token or create_signed_qr_token(bin_id, 1)

    return client.post(
        "/api/v1/submissions",
        headers=auth_headers(user_id),
        data=form_data,
        files={"photo": upload or png_upload()},
    )


def test_submission_creates_pending_after_server_side_checks_pass(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    create_location(db_session)

    response = _post_submission(client, user_id=user.id)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PENDING"
    assert data["remaining_today"] == 1
    assert data["distance_m"] <= 1
    assert data["points_awarded"] == 0
    assert data["mileage_balance"] == 0

    submission = db_session.get(Submission, data["submission_id"])
    assert submission is not None
    assert submission.status == SubmissionStatus.PENDING
    assert submission.image_path.startswith("submissions/")


def test_demo_submission_auto_approves_and_awards_real_points(
    client: TestClient,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DEMO_AUTO_APPROVE_SUBMISSIONS", "true")
    get_settings.cache_clear()
    user = create_user(db_session)
    create_location(db_session)

    response = _post_submission(client, user_id=user.id)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "APPROVED"
    assert data["points_awarded"] == 1
    assert data["mileage_balance"] == 1

    submission = db_session.get(Submission, data["submission_id"])
    refreshed_user = db_session.get(User, user.id)
    point_transaction = db_session.scalar(
        select(PointTransaction).where(
            PointTransaction.submission_id == data["submission_id"]
        )
    )
    assert submission is not None
    assert submission.status == SubmissionStatus.APPROVED
    assert submission.reviewed_at is not None
    assert refreshed_user is not None
    assert refreshed_user.mileage_balance == 1
    assert point_transaction is not None
    assert point_transaction.amount == 1


def test_submission_requires_verified_user(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(
        db_session,
        email="unverified@hufs.ac.kr",
        student_number="202400020",
        verified=False,
    )
    create_location(db_session)

    response = _post_submission(client, user_id=user.id)

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"


def test_submission_rejects_qr_location_gps_and_image_failures(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    create_location(
        db_session,
        code="HUFS-INACTIVE",
        qr_token="inactive-token",
        is_active=False,
    )
    create_location(db_session)

    invalid_qr = _post_submission(client, user_id=user.id, token="bad-token")
    assert invalid_qr.status_code == 401
    assert invalid_qr.json()["detail"]["code"] == "INVALID_QR"

    inactive_location = _post_submission(
        client,
        user_id=user.id,
        bin_id="HUFS-INACTIVE",
        token=create_signed_qr_token("HUFS-INACTIVE", 1),
    )
    assert inactive_location.status_code == 400
    assert inactive_location.json()["detail"]["code"] == "BIN_INACTIVE"

    poor_accuracy = _post_submission(client, user_id=user.id, accuracy_m=150)
    assert poor_accuracy.status_code == 400
    assert poor_accuracy.json()["detail"]["code"] == "GPS_ACCURACY_TOO_LOW"

    too_far = _post_submission(client, user_id=user.id, latitude=37.6, longitude=127.1)
    assert too_far.status_code == 400
    assert too_far.json()["detail"]["code"] == "LOCATION_TOO_FAR"

    invalid_image = _post_submission(
        client,
        user_id=user.id,
        upload=("photo.png", b"not an actual png", "image/png"),
    )
    assert invalid_image.status_code == 400
    assert invalid_image.json()["detail"]["code"] == "INVALID_IMAGE"


def test_submission_enforces_cooldown_after_pending_submission(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    create_location(db_session)

    first_response = _post_submission(client, user_id=user.id)
    assert first_response.status_code == 200

    second_response = _post_submission(client, user_id=user.id)

    assert second_response.status_code == 429
    assert second_response.json()["detail"]["code"] == "HOURLY_LIMIT"


def test_submission_enforces_daily_limit_before_cooldown(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    location = create_location(db_session)
    create_submission(
        db_session,
        user_id=user.id,
        location_id=location.id,
        submitted_at=datetime.now(UTC),
    )
    create_submission(
        db_session,
        user_id=user.id,
        location_id=location.id,
        submitted_at=datetime.now(UTC),
    )

    response = _post_submission(client, user_id=user.id)

    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "DAILY_LIMIT"


def test_qr_verify_and_submission_eligibility(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    location = create_location(db_session)
    token = create_signed_qr_token(location.code, location.qr_secret_version)

    qr_response = client.get(
        "/api/v1/qr/verify",
        params={
            "bin_id": location.code,
            "token": token,
            "latitude": "37.597",
            "longitude": "127.058",
            "accuracy_m": "10",
        },
    )
    assert qr_response.status_code == 200
    assert qr_response.json()["can_take_photo"] is True

    eligibility_response = client.get(
        "/api/v1/submissions/eligibility",
        headers=auth_headers(user.id),
    )
    assert eligibility_response.status_code == 200
    assert eligibility_response.json()["remaining_today"] == 2
