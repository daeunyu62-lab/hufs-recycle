from datetime import UTC, datetime

from app.models import Submission, SubmissionStatus
from fastapi.testclient import TestClient
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
    qr_token: str = "test-qr-token",
    latitude: float = 37.597,
    longitude: float = 127.058,
    accuracy_m: float = 10,
    upload: tuple[str, bytes, str] | None = None,
):
    return client.post(
        "/api/v1/submissions",
        headers=auth_headers(user_id),
        data={
            "qr_token": qr_token,
            "latitude": str(latitude),
            "longitude": str(longitude),
            "accuracy_m": str(accuracy_m),
        },
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

    submission = db_session.get(Submission, data["submission_id"])
    assert submission is not None
    assert submission.status == SubmissionStatus.PENDING
    assert submission.image_path.startswith("submissions/")


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
    create_location(db_session, qr_token="inactive-token", is_active=False)
    create_location(db_session)

    invalid_qr = _post_submission(client, user_id=user.id, qr_token="missing-token")
    assert invalid_qr.status_code == 404
    assert invalid_qr.json()["detail"]["code"] == "INVALID_QR_TOKEN"

    inactive_location = _post_submission(
        client,
        user_id=user.id,
        qr_token="inactive-token",
    )
    assert inactive_location.status_code == 400
    assert inactive_location.json()["detail"]["code"] == "INACTIVE_LOCATION"

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
    assert invalid_image.json()["detail"]["code"] == "INVALID_IMAGE_TYPE"


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
    assert second_response.json()["detail"]["code"] == "COOLDOWN_NOT_FINISHED"


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
    assert response.json()["detail"]["code"] == "DAILY_LIMIT_EXCEEDED"
