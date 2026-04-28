from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from ..services.chargerService import charger_service
from ..services.sessionRecordingService import session_recording_service
from ..models.schemaValidation import ApiResponse, SessionRecordingMetadata

# REST API routes for the backend

router = APIRouter(prefix="/api/v1")


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must be a valid ISO timestamp") from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _recording_payload(request: Request, recording: SessionRecordingMetadata) -> Dict[str, object]:
    payload = recording.model_dump(mode="json")
    payload["downloadUrl"] = str(request.url_for("get_session_recording_media", recording_id=recording.recording_id))
    return payload


def _normalize_non_empty(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{field_name} is required")
    return normalized

@router.get("/chargers", response_model=ApiResponse)
async def list_chargers(status: str | None = None) -> ApiResponse:
    chargers = charger_service.list_chargers(status)
    return ApiResponse(success=True, message="Charger list retrieved", data={"chargers": chargers})

@router.get("/chargers/{charger_id}", response_model=ApiResponse)
async def get_charger(charger_id: str) -> ApiResponse:
    charger = charger_service.get_charger(charger_id)
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    return ApiResponse(success=True, message="Charger details retrieved", data={"charger": charger})


@router.post("/session-recordings", response_model=ApiResponse)
async def upload_session_recording(
    request: Request,
    charger_id: str = Form(...),
    operator_name: str = Form(...),
    started_at: str = Form(...),
    ended_at: str = Form(...),
    duration_seconds: int = Form(...),
    recording_mode: Optional[str] = Form(None),
    video: UploadFile = File(...),
) -> ApiResponse:
    normalized_charger_id = _normalize_non_empty(charger_id, "charger_id")
    normalized_operator_name = _normalize_non_empty(operator_name, "operator_name")
    if duration_seconds < 0:
        raise HTTPException(status_code=400, detail="duration_seconds must be non-negative")

    started_dt = _parse_iso_datetime(started_at, "started_at")
    ended_dt = _parse_iso_datetime(ended_at, "ended_at")
    if ended_dt < started_dt:
        raise HTTPException(status_code=400, detail="ended_at must be after started_at")

    content = await video.read()
    if not content:
        raise HTTPException(status_code=400, detail="video file is empty")

    recording = session_recording_service.create_recording(
        charger_id=normalized_charger_id,
        operator_name=normalized_operator_name,
        started_at=started_dt,
        ended_at=ended_dt,
        duration_seconds=duration_seconds,
        recording_mode=recording_mode.strip() if recording_mode else None,
        original_filename=video.filename or "session-recording.webm",
        content_type=video.content_type or "video/webm",
        content=content,
    )

    return ApiResponse(
        success=True,
        message="Session recording uploaded",
        data={"recording": _recording_payload(request, recording)},
    )


@router.get("/session-recordings", response_model=ApiResponse)
async def list_session_recordings(request: Request, charger_id: str | None = None) -> ApiResponse:
    recordings = session_recording_service.list_recordings(charger_id=charger_id)
    return ApiResponse(
        success=True,
        message="Session recordings retrieved",
        data={"recordings": [_recording_payload(request, recording) for recording in recordings]},
    )


@router.get("/session-recordings/{recording_id}", response_model=ApiResponse)
async def get_session_recording(request: Request, recording_id: str) -> ApiResponse:
    recording = session_recording_service.get_recording(recording_id)
    if not recording:
        raise HTTPException(status_code=404, detail="Session recording not found")

    return ApiResponse(
        success=True,
        message="Session recording retrieved",
        data={"recording": _recording_payload(request, recording)},
    )


@router.get("/session-recordings/{recording_id}/media", name="get_session_recording_media")
async def get_session_recording_media(recording_id: str) -> FileResponse:
    recording = session_recording_service.get_recording(recording_id)
    media_path = session_recording_service.media_path_for(recording_id)
    if not recording or not media_path:
        raise HTTPException(status_code=404, detail="Session recording media not found")

    return FileResponse(
        path=str(media_path),
        media_type=recording.content_type,
        filename=Path(recording.original_filename).name,
    )


@router.post("/session-recordings/{recording_id}/annotations", response_model=ApiResponse)
async def add_session_recording_annotation(
    request: Request,
    recording_id: str,
    operator_name: str = Form(...),
    timestamp_seconds: float = Form(...),
    note: str = Form(...),
) -> ApiResponse:
    normalized_operator_name = _normalize_non_empty(operator_name, "operator_name")
    normalized_note = _normalize_non_empty(note, "note")
    if timestamp_seconds < 0:
        raise HTTPException(status_code=400, detail="timestamp_seconds must be non-negative")

    updated = session_recording_service.add_annotation(
        recording_id=recording_id,
        operator_name=normalized_operator_name,
        timestamp_seconds=timestamp_seconds,
        note=normalized_note,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Session recording not found")

    return ApiResponse(
        success=True,
        message="Annotation added",
        data={"recording": _recording_payload(request, updated)},
    )