from datetime import datetime, timezone
from typing import Any, Dict

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Socket.IO server mounted on top of the FastAPI app.
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

app = FastAPI(title="EV Smart Maintenance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "EV Smart Maintenance backend is running"}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@sio.event
async def connect(sid: str, environ: Dict[str, Any], auth: Dict[str, Any] | None = None) -> None:
    print(f"Socket connected: {sid}")
    await sio.emit(
        "server_message",
        {"message": "Connected to EV Smart Maintenance socket"},
        to=sid,
    )


@sio.event
async def disconnect(sid: str) -> None:
    print(f"Socket disconnected: {sid}")


@sio.event
async def ping(sid: str, data: Dict[str, Any] | None = None) -> None:
    payload = data or {}
    await sio.emit(
        "pong",
        {
            "echo": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        to=sid,
    )


asgi_app = socketio.ASGIApp(sio, app)
