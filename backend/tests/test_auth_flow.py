from fastapi.testclient import TestClient


def test_register_verify_and_login_flow(client: TestClient) -> None:
    payload = {
        "email": "Student@hufs.ac.kr",
        "student_number": "202400010",
        "name": "홍길동",
        "password": "password123!",
    }

    register_response = client.post("/api/v1/auth/register", json=payload)
    assert register_response.status_code == 201

    register_data = register_response.json()
    assert register_data["user"]["email"] == "student@hufs.ac.kr"
    assert register_data["user"]["role"] == "USER"
    assert register_data["user"]["is_email_verified"] is False
    assert register_data["email_verification_required"] is True

    login_before_verify = client.post(
        "/api/v1/auth/login",
        json={
            "email": payload["email"],
            "password": payload["password"],
        },
    )
    assert login_before_verify.status_code == 403
    assert login_before_verify.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"

    verify_response = client.post(
        "/api/v1/auth/verify-email",
        json={"token": register_data["email_verification_token"]},
    )
    assert verify_response.status_code == 200
    assert verify_response.json()["status"] == "ok"

    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": payload["email"],
            "password": payload["password"],
        },
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    assert token

    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email_verified_at"] is not None


def test_registration_rejects_non_hufs_email(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "student@example.com",
            "student_number": "202400011",
            "name": "홍길동",
            "password": "password123!",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "INVALID_EMAIL_DOMAIN"


def test_registration_rejects_duplicate_email_and_student_number(
    client: TestClient,
) -> None:
    payload = {
        "email": "duplicate@hufs.ac.kr",
        "student_number": "202400012",
        "name": "홍길동",
        "password": "password123!",
    }
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201

    duplicate_email = client.post("/api/v1/auth/register", json=payload)
    assert duplicate_email.status_code == 409
    assert duplicate_email.json()["detail"]["code"] == "EMAIL_ALREADY_EXISTS"

    duplicate_student_number = client.post(
        "/api/v1/auth/register",
        json={**payload, "email": "other@hufs.ac.kr"},
    )
    assert duplicate_student_number.status_code == 409
    assert (
        duplicate_student_number.json()["detail"]["code"]
        == "STUDENT_NUMBER_ALREADY_EXISTS"
    )
