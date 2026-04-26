import React, { useEffect, useState } from 'react';
import { ChargerStatus } from '../types';
import websocketService from '../services/websocket';

const Reports: React.FC = () => {
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);

  useEffect(() => {
    websocketService.connect();
    const unsubscribe = websocketService.subscribe((items) => setChargers(items));
    return () => unsubscribe();
  }, []);

  const total = chargers.length;
  const charging = chargers.filter((c) => c.status === 'charging').length;
  const online = chargers.filter((c) => c.status === 'online').length;
  const fault = chargers.filter((c) => c.status === 'fault').length;
  const offline = chargers.filter((c) => c.status === 'offline').length;
  const avgTemp =
    total > 0
      ? (chargers.reduce((sum, c) => sum + c.temperature, 0) / total).toFixed(1)
      : '—';
  const totalPower = chargers.reduce((sum, c) => sum + c.power, 0).toFixed(1);

  return (
    <section className="reports">
      <h1>Reports &amp; Analytics</h1>

      <section>
        <h2>Session Summary</h2>
        <p style={{ marginBottom: 16, color: '#555' }}>
          Live snapshot of the current fleet session. Updates automatically as chargers report in.
        </p>

        <div className="data-cards">
          <div className="status-card status-card--neutral">
            <h3>Total Chargers</h3>
            <p>{total || '—'}</p>
          </div>
          <div className="status-card status-card--accent">
            <h3>Actively Charging</h3>
            <p>{total ? charging : '—'}</p>
          </div>
          <div className="status-card status-card--good">
            <h3>Online (Idle)</h3>
            <p>{total ? online : '—'}</p>
          </div>
          <div className="status-card status-card--warn">
            <h3>Faults Detected</h3>
            <p>{total ? fault : '—'}</p>
          </div>
          <div className="status-card status-card--neutral">
            <h3>Avg Temperature</h3>
            <p>{avgTemp !== '—' ? `${avgTemp} °C` : '—'}</p>
          </div>
          <div className="status-card status-card--accent">
            <h3>Total Output</h3>
            <p>{total ? `${totalPower} kW` : '—'}</p>
          </div>
        </div>

        {total > 0 && (
          <div className="charger-table-wrap">
            <table className="charger-table">
              <thead>
                <tr>
                  <th>Charger</th>
                  <th>Status</th>
                  <th>Voltage (V)</th>
                  <th>Current (A)</th>
                  <th>Power (kW)</th>
                  <th>Temp (°C)</th>
                  <th>Fault Code</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {chargers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
                      <span className={`status-pill status-pill--${c.status}`}>{c.status}</span>
                    </td>
                    <td>{c.voltage.toFixed(1)}</td>
                    <td>{c.current.toFixed(1)}</td>
                    <td>{c.power.toFixed(1)}</td>
                    <td>{c.temperature.toFixed(1)}</td>
                    <td>{c.errorCode ?? '—'}</td>
                    <td>{c.lastUpdated.toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total === 0 && (
          <p style={{ color: '#777', marginTop: 12 }}>Waiting for live charger data...</p>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Report Overview</h2>
        <p>Historical session reports and maintenance logs will appear here once charger sessions have been completed.</p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Data Insights</h2>
        <p>Trend analysis and predictive maintenance scores will be displayed here as session history accumulates.</p>
      </section>
    </section>
  );
};

export default Reports;
