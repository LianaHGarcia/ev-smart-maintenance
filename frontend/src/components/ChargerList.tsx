import React from 'react';
import { ChargerStatus } from '../types';

interface ChargerListProps {
  chargers: ChargerStatus[];
}

const ChargerList: React.FC<ChargerListProps> = ({ chargers }) => {
  return (
    <section aria-label="Charger list">
      <h2>Charger List</h2>
      <div className="charger-table-wrap">
        <table className="charger-table">
          <thead>
            <tr>
              <th>Charger</th>
              <th>Status</th>
              <th>Voltage (V)</th>
              <th>Current (A)</th>
              <th>Power (kW)</th>
              <th>Temp (C)</th>
              <th>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {chargers.map((charger) => (
              <tr key={charger.id}>
                <td>{charger.name}</td>
                <td>
                  <span className={`status-pill status-pill--${charger.status}`}>
                    {charger.status.replace('_', ' ')}
                  </span>
                </td>
                <td>{charger.voltage}</td>
                <td>{charger.current}</td>
                <td>{charger.power}</td>
                <td>{charger.temperature}</td>
                <td>{charger.lastUpdated.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ChargerList;
