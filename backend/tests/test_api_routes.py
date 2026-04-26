from fastapi.testclient import TestClient
import pytest

from app.api.main import app
import app.api.routes as routes


@pytest.fixture
def api_client() -> TestClient:
    with TestClient(app) as client:
        yield client


def test_list_chargers_returns_success_payload(api_client: TestClient, monkeypatch) -> None:
    sample = [
        {
            "id": "SmartGlasses-Bay-01",
            "status": "charging",
            "voltage": 405.0,
            "current": 20.0,
            "power": 8.1,
            "temperature": 36.5,
            "errorCode": None,
            "lastUpdated": "2026-04-26T00:00:00+00:00",
        }
    ]

    monkeypatch.setattr(routes.charger_service, "list_chargers", lambda status=None: sample)

    response = api_client.get("/api/v1/chargers", params={"status": "charging"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["chargers"] == sample


def test_get_charger_returns_charger_data(api_client: TestClient, monkeypatch) -> None:
    sample = {
        "id": "Belinda Street",
        "status": "online",
        "voltage": 400.0,
        "current": 0.0,
        "power": 0.0,
        "temperature": 33.0,
        "errorCode": None,
        "lastUpdated": "2026-04-26T00:00:00+00:00",
    }

    monkeypatch.setattr(routes.charger_service, "get_charger", lambda charger_id: sample)

    response = api_client.get("/api/v1/chargers/Belinda%20Street")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["charger"] == sample


def test_get_charger_returns_404_when_missing(api_client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(routes.charger_service, "get_charger", lambda charger_id: None)

    response = api_client.get("/api/v1/chargers/unknown")

    assert response.status_code == 404
    assert response.json()["detail"] == "Charger not found"
