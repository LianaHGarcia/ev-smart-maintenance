from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional
from uuid import uuid4

from ..models.schemaValidation import SessionRecordingAnnotation, SessionRecordingMetadata


class SessionRecordingService:
    def __init__(self) -> None:
        self._lock = Lock()

    def _storage_root(self) -> Path:
        configured_root = os.getenv("SESSION_RECORDING_STORAGE_DIR")
        if configured_root:
            return Path(configured_root).expanduser().resolve()
        return Path(__file__).resolve().parents[2] / "storage" / "session_recordings"

    def _metadata_dir(self) -> Path:
        path = self._storage_root() / "metadata"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _media_dir(self) -> Path:
        path = self._storage_root() / "media"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        cleaned = "".join(char if char.isalnum() or char in {"-", "_", "."} else "-" for char in filename)
        return cleaned or "recording.webm"

    @staticmethod
    def _serialize_metadata(metadata: SessionRecordingMetadata) -> Dict[str, object]:
        return metadata.model_dump(mode="json")

    def _metadata_path(self, recording_id: str) -> Path:
        return self._metadata_dir() / f"{recording_id}.json"

    def _write_metadata(self, metadata: SessionRecordingMetadata) -> None:
        self._metadata_path(metadata.recording_id).write_text(
            json.dumps(self._serialize_metadata(metadata), indent=2),
            encoding="utf-8",
        )

    def create_recording(
        self,
        *,
        charger_id: str,
        operator_name: str,
        started_at: datetime,
        ended_at: datetime,
        duration_seconds: int,
        recording_mode: Optional[str],
        original_filename: str,
        content_type: str,
        content: bytes,
    ) -> SessionRecordingMetadata:
        recording_id = uuid4().hex
        suffix = Path(original_filename).suffix or ".webm"
        stored_filename = f"{recording_id}{suffix}"
        safe_original_name = self._sanitize_filename(original_filename)

        metadata = SessionRecordingMetadata(
            recording_id=recording_id,
            charger_id=charger_id,
            operator_name=operator_name,
            started_at=started_at,
            ended_at=ended_at,
            uploaded_at=datetime.now(timezone.utc),
            duration_seconds=duration_seconds,
            recording_mode=recording_mode,
            original_filename=safe_original_name,
            stored_filename=stored_filename,
            content_type=content_type or "video/webm",
            file_size_bytes=len(content),
        )

        with self._lock:
            media_path = self._media_dir() / stored_filename
            media_path.write_bytes(content)
            self._write_metadata(metadata)

        return metadata

    def get_recording(self, recording_id: str) -> Optional[SessionRecordingMetadata]:
        metadata_path = self._metadata_path(recording_id)
        if not metadata_path.exists():
            return None

        data = json.loads(metadata_path.read_text(encoding="utf-8"))
        return SessionRecordingMetadata.model_validate(data)

    def list_recordings(self, charger_id: Optional[str] = None) -> List[SessionRecordingMetadata]:
        recordings: List[SessionRecordingMetadata] = []
        for metadata_path in sorted(self._metadata_dir().glob("*.json"), reverse=True):
            data = json.loads(metadata_path.read_text(encoding="utf-8"))
            recording = SessionRecordingMetadata.model_validate(data)
            if charger_id and recording.charger_id != charger_id:
                continue
            recordings.append(recording)

        recordings.sort(key=lambda item: item.started_at, reverse=True)
        return recordings

    def media_path_for(self, recording_id: str) -> Optional[Path]:
        metadata = self.get_recording(recording_id)
        if not metadata:
            return None
        media_path = self._media_dir() / metadata.stored_filename
        if not media_path.exists():
            return None
        return media_path

    def add_annotation(
        self,
        *,
        recording_id: str,
        operator_name: str,
        timestamp_seconds: float,
        note: str,
    ) -> Optional[SessionRecordingMetadata]:
        with self._lock:
            metadata = self.get_recording(recording_id)
            if not metadata:
                return None

            updated = metadata.model_copy(
                update={
                    "annotations": [
                        *metadata.annotations,
                        SessionRecordingAnnotation(
                            annotation_id=uuid4().hex,
                            created_at=datetime.now(timezone.utc),
                            operator_name=operator_name,
                            timestamp_seconds=timestamp_seconds,
                            note=note,
                        ),
                    ]
                }
            )
            self._write_metadata(updated)
            return updated


session_recording_service = SessionRecordingService()