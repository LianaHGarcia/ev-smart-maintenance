import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <section className="hero">
      <h1>FutureNow Smart Maintenance</h1>
      <p>Where the future is endless</p>
      <Link to="/dashboard" className="cta-button">Get Started</Link>
    </section>
  );
};

export default Home;
