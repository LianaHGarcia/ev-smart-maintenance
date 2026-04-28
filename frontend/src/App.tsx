import React from 'react';
import { Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Maintenance from './pages/Maintenance';
import Recordings from './pages/Recordings';
import Reports from './pages/Reports';
import About from './pages/About';
import Hud from './pages/Hud';
import Layout from './components/Layout/Layout';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/recordings" element={<Recordings />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/about" element={<About />} />
        <Route path="/hud" element={<Hud />} />
      </Route>
    </Routes>
  );
}

export default App;
