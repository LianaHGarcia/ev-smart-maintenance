import React from 'react';
import StatusCards from '../components/StatusCards';
import ChargerList from '../components/ChargerList';
import { ChargerStatus } from '../types';

const mockChargers: ChargerStatus[] = [
  {
    id: 'CH-001',
    name: 'Roundhay A1',
    status: 'charging',
    voltage: 402,
    current: 118,
    power: 47.4,
    temperature: 41,
    lastUpdated: new Date('2026-10-12T15:45:00'),
  },
];

const Dashboard: React.FC = () => {
  return (
    <section className="dashboard">
      <h1>Dashboard</h1>
      <StatusCards chargers={mockChargers} />
      <ChargerList chargers={mockChargers} />
    </section>
  );
};

export default Dashboard;
