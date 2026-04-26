import React, { useEffect, useState } from 'react';
import StatusCards from '../components/StatusCards';
import ChargerList from '../components/ChargerList';
import { ChargerStatus } from '../types';
import websocketService from '../services/websocket';

const Dashboard: React.FC = () => {
  const [chargers, setChargers] = useState<ChargerStatus[]>([]);

  useEffect(() => {
    websocketService.connect();

    const unsubscribe = websocketService.subscribe((nextChargers) => {
      setChargers(nextChargers);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <section className="dashboard">
      <h1>Dashboard</h1>
      <StatusCards chargers={chargers} />
      <ChargerList chargers={chargers} />
    </section>
  );
};

export default Dashboard;
