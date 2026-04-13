import React from 'react';
import { ChargerStatus } from '../types';

interface StatusCardsProps {
  chargers: ChargerStatus[];
}

type Stat = 'neutral' | 'good' | 'accent' | 'warn';

interface StatItem {
  label: string;
  value: string | number;
  tone: Stat;
}

const StatusCards: React.FC<StatusCardsProps> = ({ chargers }) => {
  const online = chargers.filter((c) => c.status === 'online' || c.status === 'charging').length;
  const charging = chargers.filter((c) => c.status === 'charging').length;
  const faults = chargers.filter((c) => c.status === 'fault').length;
  const avgTemp = chargers.length > 0
    ? chargers.reduce((sum, c) => sum + c.temperature, 0) / chargers.length
    : 0;

  const stats: StatItem[] = [
    { label: 'Total Chargers', value: chargers.length, tone: 'neutral' },
    { label: 'Online', value: online, tone: 'good' },
    { label: 'Charging', value: charging, tone: 'accent' },
    { label: 'Fault Alerts', value: faults, tone: 'warn' },
    { label: 'Avg Temperature', value: `${avgTemp.toFixed(1)} C`, tone: 'neutral' },
  ];

  return (
    <section aria-label="Summary statistics">
      <h2>Summary Statistics</h2>
      <div className="data-cards">
        {stats.map((stat) => (
          <article key={stat.label} className={`status-card status-card--${stat.tone}`}>
            <h3>{stat.label}</h3>
            <p>{stat.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default StatusCards;
