import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="home-container">
      <section className="hero">
        <h1>FutureNow Smart Maintenance</h1>
        <p>Where the future is endless</p>
        <Link to="/hud?guide=1&handsFree=1" className="cta-button">Get Started</Link>
      </section>
    </div>
  );
};

export default Home;
