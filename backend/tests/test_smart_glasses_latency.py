import asyncio
from time import perf_counter

import app.api.websocket as websocket


def test_real_time_data_emits_update_within_latency_budget(monkeypatch) -> None:
    emitted = []

    async def fake_emit(event, payload, to=None):
        emitted.append((event, payload, to))

    def fake_upsert(data):
        return {
            "id": "SmartGlasses-Bay-01",
            "status": "charging",
            "voltage": 404.0,
            "current": 25.0,
            "power": 10.1,
            "temperature": 37.4,
            "errorCode": None,
            "lastUpdated": "2026-04-26T00:00:00+00:00",
        }

    monkeypatch.setattr(websocket.sio, "emit", fake_emit)
    monkeypatch.setattr(websocket.charger_service, "create_or_update_charger", fake_upsert)

    start = perf_counter()
    asyncio.run(
        websocket.real_time_data(
            "smart-glasses-client",
            {
                "charger_id": "SmartGlasses-Bay-01",
                "status": "charging",
                "voltage": 404.0,
                "current": 25.0,
                "power": 10.1,
                "temperature": 37.4,
            },
        )
    )
    elapsed_ms = (perf_counter() - start) * 1000

    assert elapsed_ms < 150
    assert emitted
    assert emitted[0][0] == "charger_update"
    assert emitted[0][1]["charger"]["id"] == "SmartGlasses-Bay-01"


def test_real_time_data_error_path_is_low_latency(monkeypatch) -> None:
    emitted = []

    async def fake_emit(event, payload, to=None):
        emitted.append((event, payload, to))

    def fake_upsert(_data):
        raise ValueError("charger_id is required")

    monkeypatch.setattr(websocket.sio, "emit", fake_emit)
    monkeypatch.setattr(websocket.charger_service, "create_or_update_charger", fake_upsert)

    start = perf_counter()
    asyncio.run(websocket.real_time_data("smart-glasses-client", {}))
    elapsed_ms = (perf_counter() - start) * 1000

    assert elapsed_ms < 150
    assert emitted
    assert emitted[0][0] == "error"
    assert emitted[0][1]["message"] == "charger_id is required"
