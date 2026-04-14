import socketio
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..services.chargerService import charger_service
from ..models.schemaValidation import RealTimeData

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode="asgi",
)


@sio.event
async def connect(sid: str, environ: Dict[str, Any]) -> None:
    print(f"[Socket.IO] Client connected: {sid}")
    await sio.emit(
        "connected",
        {
            "message": "Connected to EV Smart Maintenance",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        to=sid,
    )
    await sio.emit("chargers_list", {"chargers": charger_service.list_chargers()}, to=sid)


@sio.event
async def disconnect(sid: str) -> None:
    print(f"[Socket.IO] Client disconnected: {sid}")


@sio.event
async def get_chargers(sid: str, data: Optional[Dict[str, Any]] = None) -> None:
    status_filter = (data or {}).get("status")
    chargers = charger_service.list_chargers(status=status_filter)
    await sio.emit("chargers_list", {"chargers": chargers}, to=sid)


@sio.event
async def get_charger(sid: str, data: Dict[str, Any]) -> None:
    charger_id = (data or {}).get("charger_id", "")
    charger = charger_service.get_charger(charger_id)
    if charger:
        await sio.emit("charger_data", {"charger": charger}, to=sid)
    else:
        await sio.emit("error", {"message": f"Charger '{charger_id}' not found"}, to=sid)


@sio.event
async def update_charger_status(sid: str, data: Dict[str, Any]) -> None:
    charger_id = (data or {}).get("charger_id", "")
    status = (data or {}).get("status", "")
    error_code = (data or {}).get("error_code")
    error_description = (data or {}).get("error_description")

    try:
        updated = charger_service.update_status(
            charger_id=charger_id,
            status=status,
            error_code=error_code,
            error_description=error_description,
        )
    except ValueError as exc:
        await sio.emit("error", {"message": str(exc)}, to=sid)
        return

    if updated:
        await sio.emit("charger_updated", {"charger": updated})
    else:
        await sio.emit("error", {"message": f"Charger '{charger_id}' not found"}, to=sid)


@sio.event
async def upsert_charger(sid: str, data: Dict[str, Any]) -> None:
    try:
        charger = charger_service.create_or_update_charger(data or {})
    except ValueError as exc:
        await sio.emit("error", {"message": str(exc)}, to=sid)
        return
    await sio.emit("charger_updated", {"charger": charger})


@sio.event
async def real_time_data(sid: str, data: Dict[str, Any]) -> None:
    try:
        charger = charger_service.create_or_update_charger(data or {})
    except ValueError as exc:
        await sio.emit("error", {"message": str(exc)}, to=sid)
        return
    await sio.emit("charger_update", {"charger": charger})


async def broadcast_charger_data(data: RealTimeData) -> None:
    await sio.emit("charger-data", data.model_dump())
