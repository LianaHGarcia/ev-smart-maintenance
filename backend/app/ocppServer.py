import logging
import os
from typing import Optional

import websockets
from websockets.server import WebSocketServer

from .ChargePointHandler import ChargePointHandler
from .services.chargerService import charger_service

logger = logging.getLogger(__name__)
_ocpp_server: Optional[WebSocketServer] = None


async def _on_connect(websocket, path: Optional[str] = None) -> None:
    # websockets can call handlers as (websocket) or (websocket, path) depending on version.
    request_path = path
    if request_path is None:
        request_path = getattr(websocket, "path", None)
    if request_path is None:
        request = getattr(websocket, "request", None)
        request_path = getattr(request, "path", None)

    charge_point_id = (request_path or "").strip("/") or "unknown-cp"
    logger.info("OCPP charger connected: %s", charge_point_id)

    # Mark charger online immediately on connection
    charger_service.create_or_update_charger(
        {
            "charger_id": charge_point_id,
            "status": "online",
        }
    )

    cp = ChargePointHandler(charge_point_id, websocket)
    try:
        await cp.start()
    except Exception as exc:  # pragma: no cover
        logger.exception("OCPP session error for %s: %s", charge_point_id, exc)
    finally:
        charger_service.update_status(charge_point_id, "offline")
        logger.info("OCPP charger disconnected: %s", charge_point_id)


async def start_ocpp_server() -> None:
    global _ocpp_server
    if _ocpp_server is not None:
        return

    host = os.getenv("OCPP_HOST", "0.0.0.0")
    port = int(os.getenv("OCPP_PORT", "9000"))

    _ocpp_server = await websockets.serve(
        _on_connect,
        host,
        port,
        subprotocols=["ocpp1.6"],
    )
    logger.info("OCPP server listening on ws://%s:%s", host, port)


async def stop_ocpp_server() -> None:
    global _ocpp_server
    if _ocpp_server is None:
        return

    _ocpp_server.close()
    await _ocpp_server.wait_closed()
    _ocpp_server = None
    logger.info("OCPP server stopped")
