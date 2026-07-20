from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "HUFS Recycle API",
        "environment": "test",
    }


def test_database_health_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/health/db")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "ok",
    }
