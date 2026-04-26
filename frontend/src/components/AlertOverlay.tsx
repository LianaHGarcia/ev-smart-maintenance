import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChargerStatus } from '../types';
import websocketService from '../services/websocket';

interface AlertItem {
  id: string;
  chargerId: string;
  message: string;
  createdAt: number;
}

const MAX_ALERTS = 3;

const AlertOverlay: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  // Tracks the latest fault signature per charger to avoid duplicats
  const seenFaultAtRef = useRef<Record<string, string>>({});

  useEffect(() => {
    websocketService.connect();

    const unsubscribe = websocketService.subscribe((items: ChargerStatus[]) => {
      const freshAlerts: AlertItem[] = [];

      items.forEach((charger) => {
        if (charger.status !== 'fault') {
          return;
        }

        const seenKey = seenFaultAtRef.current[charger.id];
        const nextKey = `${charger.lastUpdated.toISOString()}|${charger.errorCode || 'no-code'}`;

        if (seenKey === nextKey) {
          return;
        }

        seenFaultAtRef.current[charger.id] = nextKey;
        freshAlerts.push({
          id: `${charger.id}-${Date.now()}`,
          chargerId: charger.id,
          message: charger.errorCode || 'Fault detected',
          createdAt: Date.now(),
        });
      });

      if (freshAlerts.length > 0) {
        // Keep newest alerts first and cap total count to avoid overwhelming the user.
        setAlerts((prev) => [...freshAlerts, ...prev].slice(0, MAX_ALERTS));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const visibleAlerts = useMemo(() => alerts.slice(0, MAX_ALERTS), [alerts]);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <aside className="alert-overlay" aria-live="assertive" aria-label="Fault alerts">
      {visibleAlerts.map((alert) => (
        <div className="alert-overlay__item" key={alert.id}>
          <div>
            <strong>Fault</strong>
            <p>{alert.chargerId}: {alert.message}</p>
          </div>
          <button type="button" onClick={() => dismissAlert(alert.id)} aria-label="Dismiss alert">
            Close
          </button>
        </div>
      ))}
    </aside>
  );
};

export default AlertOverlay;