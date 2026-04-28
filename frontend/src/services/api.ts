import axios from 'axios';
import { ChargerStatus, SessionData, SessionRecording } from '../types/index';


const API_BASE_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

//get all status of chargers

export const fetchChargers = async (): Promise<ChargerStatus[]> => {
    try{
  const response = await api.get('/chargers');
  return response.data;
} catch (error) {
  console.error('Error fetching chargers:', error);
  throw error;
}
};

//get details of a specific charger 
export const fetchChargerDetails = async (id: string): Promise<ChargerStatus> => {
  try {
    const response = await api.get(`/chargers/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching charger details:', error);
    throw error;
  }
};

//get all sessions of chargers
export const fetchSessions = async (chargerId?: string): Promise<SessionData[]> => {
  try {
    const url = chargerId ? `/sessions?chargerId=${chargerId}` : '/sessions';
    const response = await api.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching sessions:', error);
    throw error;
  }
};

//get session replay data
export const fetchSessionReplay = async (sessionId: string): Promise<SessionData> => {
  try {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching session replay:', error);
    throw error;
  }
};

export interface UploadSessionRecordingPayload {
  video: Blob;
  filename: string;
  chargerId: string;
  operatorName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  recordingMode?: string;
}

export const uploadSessionRecording = async (
  payload: UploadSessionRecordingPayload,
): Promise<SessionRecording> => {
  const formData = new FormData();
  formData.append('video', payload.video, payload.filename);
  formData.append('charger_id', payload.chargerId);
  formData.append('operator_name', payload.operatorName);
  formData.append('started_at', payload.startedAt);
  formData.append('ended_at', payload.endedAt);
  formData.append('duration_seconds', String(payload.durationSeconds));
  if (payload.recordingMode) {
    formData.append('recording_mode', payload.recordingMode);
  }

  const response = await api.post('/api/v1/session-recordings', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data.recording;
};

export const fetchSessionRecordings = async (chargerId?: string): Promise<SessionRecording[]> => {
  const response = await api.get('/api/v1/session-recordings', {
    params: chargerId ? { charger_id: chargerId } : undefined,
  });

  return response.data.data.recordings;
};

export const fetchSessionRecording = async (recordingId: string): Promise<SessionRecording> => {
  const response = await api.get(`/api/v1/session-recordings/${recordingId}`);
  return response.data.data.recording;
};

export interface CreateSessionRecordingAnnotationPayload {
  recordingId: string;
  operatorName: string;
  timestampSeconds: number;
  note: string;
}

export const createSessionRecordingAnnotation = async (
  payload: CreateSessionRecordingAnnotationPayload,
): Promise<SessionRecording> => {
  const formData = new FormData();
  formData.append('operator_name', payload.operatorName);
  formData.append('timestamp_seconds', String(payload.timestampSeconds));
  formData.append('note', payload.note);

  const response = await api.post(`/api/v1/session-recordings/${payload.recordingId}/annotations`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.data.recording;
};