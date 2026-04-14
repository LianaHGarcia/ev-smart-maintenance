from datetime import datetime, timezone
from typing import Any, Dict

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.websocket import sio
from .ocpp_server import start_ocpp_server, stop_ocpp_server

app = FastAPI(title="EV Smart Maintenance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event() -> None:
    await start_ocpp_server()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await stop_ocpp_server()


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "EV Smart Maintenance backend is running"}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


asgi_app = socketio.ASGIApp(sio, app)
