import { io, Socket } from 'socket.io-client';
import { ChargerStatus } from '../types';

interface ChargerEventPayload {
  charger?: BackendCharger;
}

interface ChargersListPayload {
  chargers?: BackendCharger[];
}

interface BackendCharger {
  id: string;
  status: ChargerStatus['status'];
  voltage: number;
  current: number;
  power: number;
  temperature: number;
  errorCode?: string;
  lastUpdated: string;
}

let socket: Socket | null = null;
let chargers: ChargerStatus[] = [];
let isConnected = false;
let listeners: Array<(items: ChargerStatus[]) => void> = [];

function resolveServerUrl(): string {
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:8000';
}

function toChargerStatus(charger: BackendCharger): ChargerStatus {
  return {
    id: charger.id,
    name: charger.id,
    status: charger.status,
    voltage: Number(charger.voltage || 0),
    current: Number(charger.current || 0),
    power: Number(charger.power || 0),
    temperature: Number(charger.temperature || 0),
    errorCode: charger.errorCode,
    lastUpdated: new Date(charger.lastUpdated),
  };
}

function emitChargers() {
  const snapshot = [...chargers];
  listeners.forEach((listener) => listener(snapshot));
}

function upsertCharger(charger: ChargerStatus) {
  const idx = chargers.findIndex((item) => item.id === charger.id);
  if (idx >= 0) {
    chargers[idx] = charger;
  } else {
    chargers.push(charger);
  }
  emitChargers();
}

function connect() {
  if (socket) {
    return;
  }

  socket = io(resolveServerUrl(), {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    isConnected = true;
    socket?.emit('get_chargers', {});
  });

  socket.on('chargers_list', (payload: ChargersListPayload) => {
    chargers = (payload?.chargers || []).map((item) => toChargerStatus(item));
    emitChargers();
  });

  socket.on('charger_updated', (payload: ChargerEventPayload) => {
    if (!payload || !payload.charger) {
      return;
    }
    upsertCharger(toChargerStatus(payload.charger));
  });

  socket.on('disconnect', () => {
    isConnected = false;
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });
}

function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
  }
}

function subscribe(callback: (items: ChargerStatus[]) => void): () => void {
  listeners.push(callback);
  callback([...chargers]);

  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

function getConnectionStatus(): boolean {
  return isConnected;
}

export default {
  connect,
  disconnect,
  subscribe,
  getConnectionStatus,
};
