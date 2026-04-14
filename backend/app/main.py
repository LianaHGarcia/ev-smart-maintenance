from datetime import datetime, timezone
from typing import Any, Dict

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.websocket import sio

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


asgi_app = socketio.ASGIApp(sio, app)
