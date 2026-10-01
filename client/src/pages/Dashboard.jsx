import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import StatGrid from '../components/StatGrid.jsx';
import { apiRequest } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function DashboardPage() {
  const { user, logout } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);
  const [stats, setStats] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const [notificationsRes, unreadRes] = await Promise.all([
          apiRequest('/api/notifications/my'),
          apiRequest('/api/notifications/unread-count')
        ]);

        setNotifications((notificationsRes.notifications || []).slice(0, 8));

        const statItems = [['Unread Alerts', unreadRes.unread]];

        if (user.role === 'admin') {
          const adminStats = await apiRequest('/api/admin/stats');
          statItems.push(['Users', adminStats.stats.users]);
          statItems.push(['Blood Banks', adminStats.stats.bloodBanks]);
          statItems.push(['Open Emergency', adminStats.stats.openEmergency]);
          statItems.push(['Total Units', adminStats.stats.totalStock]);
        }

        if (user.role === 'blood_bank') {
          const [stockRes, lowStockRes] = await Promise.all([
            apiRequest('/api/blood-bank/stock'),
            apiRequest('/api/blood-bank/low-stock?threshold=5')
          ]);

          const totalUnits = (stockRes.stock || []).reduce(
            (sum, item) => sum + Number(item.units_available || 0),
            0
          );
          statItems.push(['Tracked Groups', stockRes.stock.length]);
          statItems.push(['Total Units', totalUnits]);
          statItems.push(['Low Stock Groups', lowStockRes.lowStock.length]);
        }

        if (user.role === 'user') {
          const [bookings, emergency] = await Promise.all([
            apiRequest('/api/bookings/my'),
            apiRequest('/api/emergency-requests/my')
          ]);

          const pendingBookings = bookings.bookings.filter((b) => b.status === 'pending').length;
          const openEmergency = emergency.requests.filter((r) => r.status === 'open').length;

          statItems.push(['My Bookings', bookings.bookings.length]);
          statItems.push(['Pending Bookings', pendingBookings]);
          statItems.push(['Open Emergency', openEmergency]);
        }

        if (user.role === 'donor') {
          const [requests, responses] = await Promise.all([
            apiRequest('/api/donor/requests'),
            apiRequest('/api/donor/responses')
          ]);

          const accepted = responses.responses.filter((r) => r.status === 'accepted').length;
          statItems.push(['Matching Requests', requests.requests.length]);
          statItems.push(['Accepted Responses', accepted]);
          statItems.push(['Total Responses', responses.responses.length]);
        }

        setStats(statItems);
        setMessage('Dashboard loaded with animated summary.');
        setMessageError(false);
      } catch (error) {
        setMessage(error.message);
        setMessageError(true);
      }
    }

    load();
  }, [user]);

  const subtitle = useMemo(() => {
    if (!user) return 'Loading profile...';
    return `${user.name} (${user.role}) | ${user.email}`;
  }, [user]);

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Command Center"
      subtitle={subtitle}
      actions={
        <div className="actions">
          <Link to="/" className="btn ghost">Home</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      }
    >
      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Live Overview</p>
            <h2>System Snapshot</h2>
          </div>
          <span className="tag">Auto-refresh</span>
        </div>
        <StatGrid items={stats} />
      </section>

      <section className="feature-grid">
        <article className="feature-card">
          <p className="eyebrow">Discover</p>
          <h3>Find Blood Stock</h3>
          <p>Search availability, check compatibility, and manage favorites.</p>
          <Link to="/discover" className="btn">Open Discover</Link>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Workflow</p>
          <h3>Run Operations</h3>
          <p>Handle booking approvals, donor updates, and emergency response.</p>
          <Link to="/workflow" className="btn">Open Workflow</Link>
        </article>
        <article className="feature-card">
          <p className="eyebrow">Analytics</p>
          <h3>Track Demand</h3>
          <p>Visualize booking flow, low stock alerts, and response trends.</p>
          <Link to="/analytics" className="btn">Open Analytics</Link>
        </article>
      </section>

      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Alerts</p>
            <h2>Recent Notifications</h2>
          </div>
          <span className="tag">Latest events</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Message</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr><td colSpan="4">No notifications yet.</td></tr>
              ) : (
                notifications.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.title}</td>
                    <td>{row.body}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="message" aria-live="polite" style={{ color: messageError ? '#8b0000' : '#1c3f5e' }}>
        {message}
      </p>
    </AppShell>
  );
}

