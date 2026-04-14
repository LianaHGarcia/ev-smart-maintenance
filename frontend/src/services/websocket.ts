import {io, Socket} from 'socket.io-client';
import { RealTimeData } from '../types/index';

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: ((data: RealTimeData) => void)[] = [];
  private isConnected: boolean = false;

  connect() {
    if (this.socket) {
      console.log('Connecting to WebSocket server...');
      return;
    }

    this.socket = io(process.env.REACT_APP_WS_URL || 'http://localhost:8000', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
    });

    this.socket.on('chargerData', (data: RealTimeData) => {
      this.listeners.forEach(listener => listener(data));
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  //to be able to disconnect from backend
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('WebSocket disconnected');
    }
  }

  //to be able to subscribe to real-time data updates
  subscribe(callback: (data: RealTimeData) => void): () => void {
    this.listeners.push(callback);
    console.log(`[WS] Subscriber added (total: ${this.listeners.length})`);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
      console.log(`[WS] Subscriber removed (remaining: ${this.listeners.length})`);
    };
  }

  //check current connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

    export default new WebSocketService();
    