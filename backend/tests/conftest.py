from fastapi.testclient import TestClient
import pytest

from app.main import app
import app.main as app_main


@pytest.fixture
def client(monkeypatch):
    async def _noop() -> None:
        return None

    # Prevent real OCPP startup/shutdown side effects during tests.
    monkeypatch.setattr(app_main, "start_ocpp_server", _noop)
    monkeypatch.setattr(app_main, "stop_ocpp_server", _noop)

    with TestClient(app) as test_client:
        yield test_client
