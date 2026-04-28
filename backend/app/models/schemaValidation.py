from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional, List

# Defines the data models for validating incoming data related to maintenance sessions, vehicles, and tasks

class ChargerStatusEnum(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    CHARGING = "charging"
    FAULT = "fault"

class ChargerStatus(BaseModel):
    charger_id: str
    status: ChargerStatusEnum
    last_updated: datetime
    voltage: float
    current: float
    power: float
    temperature: float
    error_code: Optional[str] = None
    error_description: Optional[str] = None

class RealTimeData(BaseModel):
    vehicle_id: str
    timestamp: datetime
    voltage: float
    current: float
    power: float
    location: Optional[str] = None
    charger_status: Optional[ChargerStatus] = None

class ApiResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


class SessionRecordingAnnotation(BaseModel):
    annotation_id: str
    created_at: datetime
    operator_name: str
    timestamp_seconds: float
    note: str


class SessionRecordingMetadata(BaseModel):
    recording_id: str
    charger_id: str
    operator_name: str
    started_at: datetime
    ended_at: datetime
    uploaded_at: datetime
    duration_seconds: int
    recording_mode: Optional[str] = None
    original_filename: str
    stored_filename: str
    content_type: str
    file_size_bytes: int
    download_url: Optional[str] = None
    annotations: List[SessionRecordingAnnotation] = []