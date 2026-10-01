import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import StatGrid from '../components/StatGrid.jsx';
import { apiRequest } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

function ChartRow({ label, value, max, tone, valueLabel }) {
  const percent = max <= 0 ? 0 : Math.max(3, Math.round((value / max) * 100));
  return (
    <div className="chart-row">
      <span className="chart-label">{label}</span>
      <div className="chart-track">
        <div className={`chart-fill ${tone}`} style={{ '--bar-width': `${percent}%` }}></div>
      </div>
      <span className="chart-value">{valueLabel}</span>
    </div>
  );
}

function DualChartRow({ label, values, max, tones }) {
  const [valueA, valueB] = values;
  const percentA = max <= 0 ? 0 : Math.max(3, Math.round((valueA / max) * 100));
  const percentB = max <= 0 ? 0 : Math.max(3, Math.round((valueB / max) * 100));
  return (
    <div className="chart-row">
      <span className="chart-label">{label}</span>
      <div className="chart-dual">
        <div className="chart-track">
          <div className={`chart-fill ${tones[0]}`} style={{ '--bar-width': `${percentA}%` }}></div>
        </div>
        <div className="chart-track">
          <div className={`chart-fill ${tones[1]}`} style={{ '--bar-width': `${percentB}%` }}></div>
        </div>
      </div>
      <span className="chart-value">{valueA}/{valueB}</span>
    </div>
  );
}

function TripleChartRow({ label, values, max, tones }) {
  const percents = values.map((value) => (max <= 0 ? 0 : Math.max(3, Math.round((value / max) * 100))));
  return (
    <div className="chart-row">
      <span className="chart-label">{label}</span>
      <div className="chart-dual">
        {percents.map((percent, index) => (
          <div className="chart-track" key={`${label}-${index}`}>
            <div className={`chart-fill ${tones[index]}`} style={{ '--bar-width': `${percent}%` }}></div>
          </div>
        ))}
      </div>
      <span className="chart-value">{values.join('/')}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, logout } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);
  const [days, setDays] = useState(14);

  const [adminKpis, setAdminKpis] = useState([]);
  const [adminTimeline, setAdminTimeline] = useState([]);
  const [adminCity, setAdminCity] = useState([]);
  const [adminGroup, setAdminGroup] = useState([]);

  const [bankKpis, setBankKpis] = useState([]);
  const [bankTimeline, setBankTimeline] = useState([]);
  const [bankStock, setBankStock] = useState([]);

  const [userKpis, setUserKpis] = useState([]);
  const [userTimeline, setUserTimeline] = useState([]);
  const [userTimelineTone, setUserTimelineTone] = useState({ kind: 'dual', tones: ['primary', 'secondary'] });

  const subtitle = user ? `${user.name} (${user.role}) | ${user.email}` : 'Loading profile...';

  async function loadAdmin(selectedDays) {
    const data = await apiRequest(`/api/admin/analytics/summary?days=${selectedDays}`);

    const totalBookings = data.timeline.reduce((sum, row) => sum + Number(row.bookings || 0), 0);
    const totalEmergency = data.timeline.reduce((sum, row) => sum + Number(row.emergencies || 0), 0);

    setAdminKpis([
      ['Total Bookings', totalBookings],
      ['Total Emergencies', totalEmergency],
      ['Approved Bookings', Number(data.approvedBookings || 0)],
      ['Cities with Demand', data.cityDemand.length]
    ]);

    setAdminTimeline(data.timeline || []);
    setAdminCity(data.cityDemand || []);
    setAdminGroup(data.bloodGroupDemand || []);
  }

  async function loadBank(selectedDays) {
    const data = await apiRequest(`/api/blood-bank/analytics?days=${selectedDays}`);

    const totalRequests = data.timeline.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const approved = data.timeline.reduce((sum, row) => sum + Number(row.approved || 0), 0);
    const pending = data.timeline.reduce((sum, row) => sum + Number(row.pending || 0), 0);
    const totalUnits = data.stockDistribution.reduce((sum, row) => sum + Number(row.units_available || 0), 0);

    setBankKpis([
      ['Total Requests', totalRequests],
      ['Approved', approved],
      ['Pending', pending],
      ['Total Units', totalUnits]
    ]);

    setBankTimeline(data.timeline || []);
    setBankStock(data.stockDistribution || []);
  }

  async function loadUserOrDonor(selectedDays) {
    const data = await apiRequest(`/api/activity/my?days=${selectedDays}`);

    if (data.kind === 'donor') {
      const total = data.timeline.reduce((sum, row) => sum + Number(row.responses || 0), 0);
      setUserKpis([
        ['Total Responses', total],
        ['Active Days', data.timeline.filter((r) => Number(r.responses || 0) > 0).length]
      ]);
      setUserTimeline(data.timeline.map((row) => ({ label: row.day.slice(5), a: Number(row.responses || 0) })));
      setUserTimelineTone({ kind: 'single', tones: ['ok'] });
      return;
    }

    if (data.kind === 'blood_bank') {
      const totalRequests = data.timeline.reduce((sum, row) => sum + Number(row.requests || 0), 0);
      const totalApproved = data.timeline.reduce((sum, row) => sum + Number(row.approved || 0), 0);
      setUserKpis([
        ['Requests', totalRequests],
        ['Approved', totalApproved]
      ]);
      setUserTimeline(
        data.timeline.map((row) => ({ label: row.day.slice(5), a: Number(row.requests || 0), b: Number(row.approved || 0) }))
      );
      setUserTimelineTone({ kind: 'dual', tones: ['primary', 'ok'] });
      return;
    }

    const totalBookings = data.timeline.reduce((sum, row) => sum + Number(row.bookings || 0), 0);
    const totalEmergency = data.timeline.reduce((sum, row) => sum + Number(row.emergencies || 0), 0);
    setUserKpis([
      ['My Bookings', totalBookings],
      ['My Emergencies', totalEmergency]
    ]);

    setUserTimeline(
      data.timeline.map((row) => ({ label: row.day.slice(5), a: Number(row.bookings || 0), b: Number(row.emergencies || 0) }))
    );
    setUserTimelineTone({ kind: 'dual', tones: ['primary', 'secondary'] });
  }

  async function loadByRole(selectedDays) {
    if (!user) return;

    if (user.role === 'admin') {
      await loadAdmin(selectedDays);
      return;
    }

    if (user.role === 'blood_bank') {
      await loadBank(selectedDays);
      return;
    }

    await loadUserOrDonor(selectedDays);
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await loadByRole(days);
        setMessage('Analytics ready with animated trends.');
        setMessageError(false);
      } catch (error) {
        setMessage(error.message);
        setMessageError(true);
      }
    })();
  }, [user, days]);

  const adminTimelineMax = Math.max(
    ...adminTimeline.map((row) => Math.max(Number(row.bookings || 0), Number(row.emergencies || 0))),
    1
  );

  const bankTimelineMax = Math.max(
    ...bankTimeline.map((row) => Math.max(Number(row.total || 0), Number(row.approved || 0), Number(row.pending || 0))),
    1
  );

  const userTimelineMax = Math.max(
    ...userTimeline.map((row) => Math.max(Number(row.a || 0), Number(row.b || 0))),
    1
  );

  return (
    <AppShell
      eyebrow="Analytics"
      title="Insights and Trends"
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
            <p className="eyebrow">Range</p>
            <h2>Choose a window</h2>
          </div>
          <span className="tag">Last 7 to 60 days</span>
        </div>
        <form
          className="form inline"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage('Analytics refreshed.');
            setMessageError(false);
          }}
        >
          <label>Days
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
            </select>
          </label>
          <button type="submit" className="btn">Reload Analytics</button>
        </form>
      </section>

      {user?.role === 'admin' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Admin</p>
              <h2>System Analytics</h2>
            </div>
            <span className="tag">Network wide</span>
          </div>
          <StatGrid items={adminKpis} />

          <h3>Daily Bookings vs Emergency Requests</h3>
          <div className="chart-grid">
            {adminTimeline.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="primary" valueLabel="0" />
            ) : (
              adminTimeline.map((row) => (
                <DualChartRow
                  key={row.day}
                  label={row.day ? row.day.slice(5) : row.label}
                  values={[Number(row.bookings || 0), Number(row.emergencies || 0)]}
                  max={adminTimelineMax}
                  tones={['primary', 'secondary']}
                />
              ))
            )}
          </div>

          <h3>Top Cities by Emergency Demand</h3>
          <div className="chart-grid">
            {adminCity.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="warn" valueLabel="0" />
            ) : (
              adminCity.map((row) => (
                <ChartRow
                  key={row.city}
                  label={row.city}
                  value={Number(row.total || 0)}
                  max={Math.max(...adminCity.map((r) => Number(r.total || 0)), 1)}
                  tone="warn"
                  valueLabel={Number(row.total || 0)}
                />
              ))
            )}
          </div>

          <h3>Demand by Blood Group</h3>
          <div className="chart-grid">
            {adminGroup.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="ok" valueLabel="0" />
            ) : (
              adminGroup.map((row) => (
                <ChartRow
                  key={row.blood_group}
                  label={row.blood_group}
                  value={Number(row.total || 0)}
                  max={Math.max(...adminGroup.map((r) => Number(r.total || 0)), 1)}
                  tone="ok"
                  valueLabel={Number(row.total || 0)}
                />
              ))
            )}
          </div>
        </section>
      )}

      {user?.role === 'blood_bank' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Blood Bank</p>
              <h2>Facility Analytics</h2>
            </div>
            <span className="tag">Stock + approvals</span>
          </div>
          <StatGrid items={bankKpis} />

          <h3>Daily Booking Flow</h3>
          <div className="chart-grid">
            {bankTimeline.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="primary" valueLabel="0" />
            ) : (
              bankTimeline.map((row) => (
                <TripleChartRow
                  key={row.day}
                  label={row.day ? row.day.slice(5) : row.label}
                  values={[Number(row.total || 0), Number(row.approved || 0), Number(row.pending || 0)]}
                  max={bankTimelineMax}
                  tones={['primary', 'ok', 'warn']}
                />
              ))
            )}
          </div>

          <h3>Current Stock Distribution</h3>
          <div className="chart-grid">
            {bankStock.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="secondary" valueLabel="0" />
            ) : (
              bankStock.map((row) => (
                <ChartRow
                  key={row.blood_group}
                  label={row.blood_group}
                  value={Number(row.units_available || 0)}
                  max={Math.max(...bankStock.map((r) => Number(r.units_available || 0)), 1)}
                  tone="secondary"
                  valueLabel={Number(row.units_available || 0)}
                />
              ))
            )}
          </div>
        </section>
      )}

      {user && user.role !== 'admin' && user.role !== 'blood_bank' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">My Activity</p>
              <h2>Personal Analytics</h2>
            </div>
            <span className="tag">Recent actions</span>
          </div>
          <StatGrid items={userKpis} />

          <h3>Daily Activity</h3>
          <div className="chart-grid">
            {userTimeline.length === 0 ? (
              <ChartRow label="No records" value={0} max={1} tone="primary" valueLabel="0" />
            ) : (
              userTimeline.map((row) => (
                userTimelineTone.kind === 'single' ? (
                  <ChartRow
                    key={row.label}
                    label={row.label}
                    value={row.a}
                    max={userTimelineMax}
                    tone={userTimelineTone.tones[0]}
                    valueLabel={row.a}
                  />
                ) : (
                  <DualChartRow
                    key={row.label}
                    label={row.label}
                    values={[row.a, row.b]}
                    max={userTimelineMax}
                    tones={userTimelineTone.tones}
                  />
                )
              ))
            )}
          </div>
        </section>
      )}

      <p className="message" aria-live="polite" style={{ color: messageError ? '#8b0000' : '#1c3f5e' }}>
        {message}
      </p>
    </AppShell>
  );
}

