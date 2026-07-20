from app.models import PointTransaction, SubmissionStatus, UserRole
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.factories import (
    auth_headers,
    create_location,
    create_submission,
    create_user,
)


def test_user_cannot_access_admin_routes(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)

    response = client.get("/api/v1/admin/submissions", headers=auth_headers(user.id))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ADMIN_REQUIRED"

    qr_response = client.get(
        "/api/v1/admin/locations/1/qr-code",
        headers=auth_headers(user.id),
    )
    assert qr_response.status_code == 403
    assert qr_response.json()["detail"]["code"] == "ADMIN_REQUIRED"


def test_admin_can_generate_signed_qr_url(
    client: TestClient,
    db_session: Session,
) -> None:
    admin = create_user(
        db_session,
        email="admin-qr@hufs.ac.kr",
        student_number="ADMINQR",
        role=UserRole.ADMIN,
    )
    location = create_location(db_session)

    response = client.post(
        f"/api/v1/admin/locations/{location.id}/qr-token",
        headers=auth_headers(admin.id),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["bin_id"] == location.code
    assert data["token"].startswith("v1.")
    assert "bin_id=HUFS-001" in data["qr_url"]


def test_admin_can_download_scannable_qr_png(
    client: TestClient,
    db_session: Session,
) -> None:
    admin = create_user(
        db_session,
        email="admin-qr-image@hufs.ac.kr",
        student_number="ADMINQRIMAGE",
        role=UserRole.ADMIN,
    )
    location = create_location(db_session)

    response = client.get(
        f"/api/v1/admin/locations/{location.id}/qr-code",
        headers=auth_headers(admin.id),
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["content-disposition"] == (
        f'attachment; filename="trash-bin-{location.id}-qr.png"'
    )
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    assert len(response.content) > 1_000


def test_admin_approval_awards_points_once(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    admin = create_user(
        db_session,
        email="admin@hufs.ac.kr",
        student_number="ADMIN001",
        role=UserRole.ADMIN,
    )
    location = create_location(db_session)
    submission = create_submission(
        db_session,
        user_id=user.id,
        location_id=location.id,
    )

    approve_response = client.patch(
        f"/api/v1/admin/submissions/{submission.id}/approve",
        headers=auth_headers(admin.id),
    )

    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == "APPROVED"

    point_transactions = db_session.scalars(select(PointTransaction)).all()
    assert len(point_transactions) == 1
    assert point_transactions[0].amount == 1
    assert point_transactions[0].submission_id == submission.id

    points_response = client.get(
        "/api/v1/users/me/points",
        headers=auth_headers(user.id),
    )
    assert points_response.status_code == 200
    assert points_response.json()["balance"] == 1
    db_session.refresh(user)
    assert user.mileage_balance == 1

    duplicate_response = client.patch(
        f"/api/v1/admin/submissions/{submission.id}/approve",
        headers=auth_headers(admin.id),
    )
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"]["code"] == "ALREADY_REVIEWED"

    point_transactions = db_session.scalars(select(PointTransaction)).all()
    assert len(point_transactions) == 1


def test_admin_submission_list_includes_user_and_location_labels(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    admin = create_user(
        db_session,
        email="admin-list@hufs.ac.kr",
        student_number="ADMINLIST",
        role=UserRole.ADMIN,
    )
    location = create_location(db_session)
    submission = create_submission(
        db_session,
        user_id=user.id,
        location_id=location.id,
    )

    response = client.get(
        "/api/v1/admin/submissions",
        headers=auth_headers(admin.id),
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["id"] == submission.id
    assert item["user_email"] == user.email
    assert item["user_student_number"] == user.student_number
    assert item["location_code"] == location.code
    assert item["location_name"] == location.name


def test_admin_rejection_does_not_award_points(
    client: TestClient,
    db_session: Session,
) -> None:
    user = create_user(db_session)
    admin = create_user(
        db_session,
        email="admin-reject@hufs.ac.kr",
        student_number="ADMIN002",
        role=UserRole.ADMIN,
    )
    location = create_location(db_session)
    submission = create_submission(
        db_session,
        user_id=user.id,
        location_id=location.id,
    )

    reject_response = client.patch(
        f"/api/v1/admin/submissions/{submission.id}/reject",
        headers=auth_headers(admin.id),
        json={"reason": "사진에서 분리배출 여부를 확인하기 어렵습니다."},
    )

    assert reject_response.status_code == 200
    assert reject_response.json()["status"] == "REJECTED"
    assert reject_response.json()["rejection_reason"] == (
        "사진에서 분리배출 여부를 확인하기 어렵습니다."
    )

    reviewed_submission = db_session.get(type(submission), submission.id)
    assert reviewed_submission is not None
    assert reviewed_submission.status == SubmissionStatus.REJECTED
    assert db_session.scalars(select(PointTransaction)).all() == []
