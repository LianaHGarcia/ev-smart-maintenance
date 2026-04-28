export interface ChargerStatus {
    id: string;
    name: string;
    status: 'online' | 'offline' | 'charging' | 'fault';
    voltage: number;
    current: number;
    power: number;
    temperature: number;
    errorCode?: string;
    lastUpdated: Date;
}

export interface SessionData {
    sessionId: string;
    chargerId: string;
    startTime: Date;
    endTime?: Date;
    energyDelivered: number;
    maxVoltage: number;
    maxCurrent: number;
    errors: string[];
}

export interface SessionRecording {
    recording_id: string;
    charger_id: string;
    operator_name: string;
    started_at: string;
    ended_at: string;
    uploaded_at: string;
    duration_seconds: number;
    recording_mode?: string;
    original_filename: string;
    stored_filename: string;
    content_type: string;
    file_size_bytes: number;
    downloadUrl: string;
    annotations: SessionRecordingAnnotation[];
}

export interface SessionRecordingAnnotation {
    annotation_id: string;
    created_at: string;
    operator_name: string;
    timestamp_seconds: number;
    note: string;
}

export interface RealTimeData {
    chargerId: string;
    timestamp: Date;
    voltage: number;
    curret: number;
    pwer: number;
    temperature: number;
    errorCode?: string;
}