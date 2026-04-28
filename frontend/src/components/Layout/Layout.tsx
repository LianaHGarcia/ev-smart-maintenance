import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import AlertOverlay from '../AlertOverlay';

const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Maintenance', path: '/maintenance' },
    { name: 'Recordings', path: '/recordings' },
    { name: 'Reports', path: '/reports' },
    { name: 'About', path: '/about' },
];

const Layout: React.FC = () => {
    const location = useLocation();

    return (
        <div className="App layout">
            <header className="header layout-header">
                <div className="header-content">
                    <img src="/logo.png" alt="EV Smart Maintenance Logo" className="header-logo" />
                </div>
            </header>
            <nav aria-label="Primary">
                <ul className="nav-list">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;

                        return (
                            <li key={item.path} className="nav-item">
                                <Link to={item.path} className={isActive ? 'active' : ''}>
                                    {item.name}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
            <main className="layout-content">
                <Outlet />
            </main>
            {/* Mounted at layout level so alerts appear on every route, including HUD. */}
            <AlertOverlay />
            <footer className="layout-footer">
                <p>&copy; 2026 FutureNow Energy. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default Layout;