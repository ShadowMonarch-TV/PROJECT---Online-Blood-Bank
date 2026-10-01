import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { apiRequest } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function AccountPage() {
  const { user, bloodGroups, setUser, logout } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const subtitle = useMemo(() => {
    if (!user) return 'Loading profile...';
    return `${user.name} (${user.role}) | ${user.email}`;
  }, [user]);

  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    city: '',
    bloodGroup: ''
  });

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || '',
      phone: user.phone || '',
      city: user.city || '',
      bloodGroup: user.bloodGroup || ''
    });
  }, [user]);

  async function loadNotifications() {
    const [list, count] = await Promise.all([
      apiRequest('/api/notifications/my'),
      apiRequest('/api/notifications/unread-count')
    ]);

    setNotifications(list.notifications || []);
    setUnreadCount(count.unread || 0);
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await loadNotifications();
        setMessage('Account page ready.');
        setMessageError(false);
      } catch (error) {
        setMessage(error.message);
        setMessageError(true);
      }
    })();
  }, [user]);

  return (
    <AppShell
      eyebrow="Account"
      title="Profile and Alerts"
      subtitle={subtitle}
      actions={
        <div className="actions">
          <Link to="/dashboard" className="btn ghost">Dashboard</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      }
    >
      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Update Details</h2>
          </div>
          <span className="tag">Keep profile current</span>
        </div>
        <form
          className="form inline"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const data = await apiRequest('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({
                  name: profile.name,
                  phone: profile.phone || null,
                  city: profile.city || null,
                  bloodGroup: profile.bloodGroup || null
                })
              });
              setUser(data.user);
              setMessage('Profile updated.');
              setMessageError(false);
            } catch (error) {
              setMessage(error.message);
              setMessageError(true);
            }
          }}
        >
          <label>Name
            <input
              type="text"
              value={profile.name}
              onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>Phone
            <input
              type="text"
              value={profile.phone}
              onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label>City
            <input
              type="text"
              value={profile.city}
              onChange={(event) => setProfile((prev) => ({ ...prev, city: event.target.value }))}
            />
          </label>
          <label>Blood Group
            <select
              value={profile.bloodGroup || ''}
              onChange={(event) => setProfile((prev) => ({ ...prev, bloodGroup: event.target.value }))}
              required={user?.role === 'donor'}
            >
              <option value="">Not set</option>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn">Save Profile</button>
        </form>
      </section>

      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Security</p>
            <h2>Change Password</h2>
          </div>
          <span className="tag">Secure access</span>
        </div>
        <form
          className="form inline"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            try {
              await apiRequest('/api/auth/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                  currentPassword: formData.get('currentPassword'),
                  newPassword: formData.get('newPassword')
                })
              });
              event.currentTarget.reset();
              setMessage('Password changed.');
              setMessageError(false);
            } catch (error) {
              setMessage(error.message);
              setMessageError(true);
            }
          }}
        >
          <label>Current Password
            <input type="password" name="currentPassword" required />
          </label>
          <label>New Password
            <input type="password" name="newPassword" required />
          </label>
          <button type="submit" className="btn">Change Password</button>
        </form>
      </section>

      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Notifications</p>
            <h2>Alerts <span id="unreadBadge">({unreadCount} unread)</span></h2>
          </div>
          <div className="actions">
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await loadNotifications();
                  setMessage('Notifications refreshed.');
                  setMessageError(false);
                } catch (error) {
                  setMessage(error.message);
                  setMessageError(true);
                }
              }}
            >
              Refresh
            </button>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await apiRequest('/api/notifications/read-all', { method: 'PUT' });
                  await loadNotifications();
                  setMessage('All notifications marked read.');
                  setMessageError(false);
                } catch (error) {
                  setMessage(error.message);
                  setMessageError(true);
                }
              }}
            >
              Mark All Read
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr><td colSpan="6">No notifications yet.</td></tr>
              ) : (
                notifications.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.title}</td>
                    <td>{row.body}</td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.is_read ? 'Read' : 'Unread'}</td>
                    <td>
                      {row.is_read ? (
                        '-'
                      ) : (
                        <button
                          className="btn secondary"
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/notifications/${row.id}/read`, { method: 'PUT' });
                              await loadNotifications();
                              setMessage('Notification marked read.');
                              setMessageError(false);
                            } catch (error) {
                              setMessage(error.message);
                              setMessageError(true);
                            }
                          }}
                        >
                          Mark Read
                        </button>
                      )}
                    </td>
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

