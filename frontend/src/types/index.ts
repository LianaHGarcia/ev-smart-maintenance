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

export interface RealTimeData {
    chargerId: string;
    timestamp: Date;
    voltage: number;
    curret: number;
    pwer: number;
    temperature: number;
    errorCode?: string;
}