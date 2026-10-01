import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/discover', label: 'Discover' },
  { to: '/workflow', label: 'Workflow' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/account', label: 'Account' }
];

export default function AppShell({ eyebrow, title, subtitle, actions, children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('dashboard-page');
    return () => {
      document.body.classList.remove('dashboard-page');
      document.body.classList.remove('menu-open');
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
  }, [menuOpen]);

  const actionNode = useMemo(() => actions || null, [actions]);

  return (
    <>
      <div className="page-ambient"></div>
      <button
        id="sidebarToggle"
        className="sidebar-toggle"
        aria-label="Toggle menu"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        ?
      </button>
      <div
        id="sidebarOverlay"
        className="sidebar-overlay"
        onClick={() => setMenuOpen(false)}
      ></div>

      <div className="dashboard-shell">
        <aside id="sidebar" className="sidebar">
          <div className="sidebar-header">
            <h2>CrimsonNet</h2>
            <p>Smart Blood Network</p>
          </div>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="dashboard-main staggered">
          <section className="page-hero">
            <div>
              <p className="eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {actionNode}
          </section>

          {children}
        </main>
      </div>
    </>
  );
}

