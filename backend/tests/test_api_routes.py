from fastapi.testclient import TestClient
from io import BytesIO
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


def test_upload_session_recording_persists_metadata_and_media(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("SESSION_RECORDING_STORAGE_DIR", str(tmp_path / "session-recordings"))

    response = api_client.post(
        "/api/v1/session-recordings",
        data={
            "charger_id": "SmartGlasses-Bay-01",
            "operator_name": "Liana Garcia",
            "started_at": "2026-04-28T10:00:00+00:00",
            "ended_at": "2026-04-28T10:01:30+00:00",
            "duration_seconds": "90",
            "recording_mode": "screen",
        },
        files={
            "video": ("session.webm", BytesIO(b"fake-webm-content"), "video/webm"),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    recording = payload["data"]["recording"]

    assert payload["success"] is True
    assert recording["charger_id"] == "SmartGlasses-Bay-01"
    assert recording["operator_name"] == "Liana Garcia"
    assert recording["duration_seconds"] == 90
    assert recording["downloadUrl"].endswith(f"/api/v1/session-recordings/{recording['recording_id']}/media")

    listing = api_client.get("/api/v1/session-recordings", params={"charger_id": "SmartGlasses-Bay-01"})
    assert listing.status_code == 200
    listed_recordings = listing.json()["data"]["recordings"]
    assert len(listed_recordings) == 1
    assert listed_recordings[0]["recording_id"] == recording["recording_id"]

    detail = api_client.get(f"/api/v1/session-recordings/{recording['recording_id']}")
    assert detail.status_code == 200
    assert detail.json()["data"]["recording"]["original_filename"] == "session.webm"

    media = api_client.get(f"/api/v1/session-recordings/{recording['recording_id']}/media")
    assert media.status_code == 200
    assert media.content == b"fake-webm-content"
    assert media.headers["content-type"] == "video/webm"

    annotation = api_client.post(
        f"/api/v1/session-recordings/{recording['recording_id']}/annotations",
        data={
            "operator_name": "Liana Garcia",
            "timestamp_seconds": "17.5",
            "note": "Connector inspection started",
        },
    )
    assert annotation.status_code == 200
    annotation_payload = annotation.json()["data"]["recording"]
    assert len(annotation_payload["annotations"]) == 1
    assert annotation_payload["annotations"][0]["note"] == "Connector inspection started"
    assert annotation_payload["annotations"][0]["timestamp_seconds"] == 17.5


def test_upload_session_recording_validates_required_fields(
    api_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    monkeypatch.setenv("SESSION_RECORDING_STORAGE_DIR", str(tmp_path / "session-recordings"))

    response = api_client.post(
        "/api/v1/session-recordings",
        data={
            "charger_id": "SmartGlasses-Bay-01",
            "operator_name": "   ",
            "started_at": "2026-04-28T10:00:00+00:00",
            "ended_at": "2026-04-28T09:59:00+00:00",
            "duration_seconds": "60",
        },
        files={
            "video": ("session.webm", BytesIO(b"fake-webm-content"), "video/webm"),
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "operator_name is required"


def test_add_annotation_returns_404_for_missing_recording(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/v1/session-recordings/missing/annotations",
        data={
            "operator_name": "Liana Garcia",
            "timestamp_seconds": "5",
            "note": "No file",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Session recording not found"
