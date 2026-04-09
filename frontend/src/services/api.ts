import axios from 'axios';
import { ChargerStatus, SessionData } from '../types';


const API_BASE_URL = 'http://localhost:8000/api';

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