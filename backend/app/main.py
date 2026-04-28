from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

import socketio
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .api.routes import router
from .api.websocket import sio
from .ocppServer import start_ocpp_server, stop_ocpp_server

app = FastAPI(title="EV Smart Maintenance API", version="1.0.0")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_BUILD_DIR = PROJECT_ROOT / "frontend" / "build"
FRONTEND_STATIC_DIR = FRONTEND_BUILD_DIR / "static"
FRONTEND_INDEX_FILE = FRONTEND_BUILD_DIR / "index.html"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if FRONTEND_STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_STATIC_DIR)), name="frontend-static")


@app.on_event("startup")
async def startup_event() -> None:
    await start_ocpp_server()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await stop_ocpp_server()


@app.get("/")
async def root() -> Dict[str, str]:
    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(str(FRONTEND_INDEX_FILE))
    return {"message": "EV Smart Maintenance backend is running"}


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if full_path.startswith(("api/", "socket.io", "docs", "redoc", "openapi.json", "health")):
        raise HTTPException(status_code=404, detail="Not found")

    if FRONTEND_BUILD_DIR.exists():
        requested_file = FRONTEND_BUILD_DIR / full_path
        if requested_file.is_file():
            return FileResponse(str(requested_file))

    if FRONTEND_INDEX_FILE.exists():
        return FileResponse(str(FRONTEND_INDEX_FILE))

    raise HTTPException(status_code=404, detail="Frontend build not found")


asgi_app = socketio.ASGIApp(sio, app)
