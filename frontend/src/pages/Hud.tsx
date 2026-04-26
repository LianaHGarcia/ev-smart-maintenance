import React, { useEffect, useMemo, useState } from 'react';
import { ChargerStatus } from '../types';
import websocketService from '../services/websocket';

const Hud: React.FC = () => {
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);

  useEffect(() => {
    // Keep a live socket subscription so the HUD updates without page refresh.
    websocketService.connect();
    const unsubscribe = websocketService.subscribe((items) => setChargers(items));

    return () => {
      unsubscribe();
    };
  }, []);

  const activeCharger = useMemo(() => {
    // Charger in use will always show first
    const charging = chargers.find((item) => item.status === 'charging');
    if (charging) {
      return charging;
    }
    return chargers[0];
  }, [chargers]);

  if (!activeCharger) {
    return (
      <section className="hud-screen">
        <div className="hud-panel">
          <h1>Live Charger HUD</h1>
          <p>Waiting for charger telemetry...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="hud-screen" aria-label="Smart glasses live charger overlay">
      <div className="hud-panel">
        <header className="hud-header">
          <h1>{activeCharger.id}</h1>
          <span className={`status-pill status-pill--${activeCharger.status}`}>
            {activeCharger.status}
          </span>
        </header>

        <div className="hud-grid">
          <article>
            <h2>Voltage</h2>
            <p>{activeCharger.voltage.toFixed(1)} V</p>
          </article>
          <article>
            <h2>Current</h2>
            <p>{activeCharger.current.toFixed(1)} A</p>
          </article>
          <article>
            <h2>Power</h2>
            <p>{activeCharger.power.toFixed(1)} kW</p>
          </article>
          <article>
            <h2>Temperature</h2>
            <p>{activeCharger.temperature.toFixed(1)} C</p>
          </article>
        </div>

        <footer className="hud-footer">
          <span>Updated: {activeCharger.lastUpdated.toLocaleTimeString()}</span>
          {activeCharger.errorCode ? <span>Error: {activeCharger.errorCode}</span> : null}
        </footer>
      </div>
    </section>
  );
};

export default Hud;