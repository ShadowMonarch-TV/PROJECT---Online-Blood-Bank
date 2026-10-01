import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import StatGrid from '../components/StatGrid.jsx';
import { apiRequest } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function WorkflowPage() {
  const { user, bloodGroups, logout } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);

  const [myBookings, setMyBookings] = useState([]);
  const [myEmergency, setMyEmergency] = useState([]);
  const [donorRequests, setDonorRequests] = useState([]);
  const [stock, setStock] = useState([]);
  const [bankBookings, setBankBookings] = useState([]);
  const [bankLowStock, setBankLowStock] = useState([]);
  const [bankThreshold, setBankThreshold] = useState(5);
  const [adminStats, setAdminStats] = useState([]);
  const [adminLowStock, setAdminLowStock] = useState([]);
  const [adminThreshold, setAdminThreshold] = useState(5);
  const [availability, setAvailability] = useState('true');

  const subtitle = useMemo(() => {
    if (!user) return 'Loading profile...';
    return `${user.name} (${user.role}) | ${user.email}`;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setAvailability(user.isAvailable ? 'true' : 'false');
  }, [user]);

  async function loadMyBookings() {
    const data = await apiRequest('/api/bookings/my');
    setMyBookings(data.bookings || []);
  }

  async function loadMyEmergency() {
    const data = await apiRequest('/api/emergency-requests/my');
    setMyEmergency(data.requests || []);
  }

  async function loadDonorRequests() {
    const data = await apiRequest('/api/donor/requests');
    setDonorRequests(data.requests || []);
  }

  async function loadBankStock() {
    const data = await apiRequest('/api/blood-bank/stock');
    setStock(data.stock || []);
  }

  async function loadBankBookings() {
    const data = await apiRequest('/api/blood-bank/bookings?status=pending');
    setBankBookings(data.bookings || []);
  }

  async function loadBankLowStock() {
    const data = await apiRequest(`/api/blood-bank/low-stock?threshold=${bankThreshold}`);
    setBankLowStock(data.lowStock || []);
  }

  function renderAdminStats(stats) {
    return [
      ['Users', stats.users],
      ['Donors', stats.donors],
      ['Blood Banks', stats.bloodBanks],
      ['Pending Bookings', stats.pendingBookings],
      ['Open Emergency', stats.openEmergency],
      ['Total Units', stats.totalStock]
    ];
  }

  async function loadAdminStatsAndLowStock() {
    const stats = await apiRequest('/api/admin/stats');
    setAdminStats(renderAdminStats(stats.stats));

    const lowStock = await apiRequest(`/api/admin/low-stock?threshold=${adminThreshold}`);
    setAdminLowStock(lowStock.lowStock || []);
  }

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        if (user.role === 'user') {
          await Promise.all([loadMyBookings(), loadMyEmergency()]);
        }

        if (user.role === 'donor') {
          await loadDonorRequests();
        }

        if (user.role === 'blood_bank') {
          await Promise.all([loadBankStock(), loadBankBookings(), loadBankLowStock()]);
        }

        if (user.role === 'admin') {
          await loadAdminStatsAndLowStock();
        }

        setMessage('Workflow page ready.');
        setMessageError(false);
      } catch (error) {
        setMessage(error.message);
        setMessageError(true);
      }
    })();
  }, [user]);

  return (
    <AppShell
      eyebrow="Workflow"
      title="Role Operations Hub"
      subtitle={subtitle}
      actions={
        <div className="actions">
          <Link to="/dashboard" className="btn ghost">Dashboard</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      }
    >
      {user?.role === 'user' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">User Module</p>
              <h2>Book Blood and Alerts</h2>
            </div>
            <span className="tag">Patient actions</span>
          </div>
          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              try {
                await apiRequest('/api/bookings', {
                  method: 'POST',
                  body: JSON.stringify({
                    bankId: Number(formData.get('bankId')),
                    bloodGroup: formData.get('bloodGroup'),
                    unitsRequired: Number(formData.get('unitsRequired'))
                  })
                });
                await loadMyBookings();
                setMessage('Booking request submitted.');
                setMessageError(false);
                event.currentTarget.reset();
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Bank ID
              <input type="number" name="bankId" min="1" required />
            </label>
            <label>Blood Group
              <select name="bloodGroup" required>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>Units
              <input type="number" name="unitsRequired" min="1" required />
            </label>
            <button type="submit" className="btn">Book Blood</button>
          </form>

          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              try {
                await apiRequest('/api/emergency-requests', {
                  method: 'POST',
                  body: JSON.stringify({
                    bloodGroup: formData.get('bloodGroup'),
                    unitsNeeded: Number(formData.get('unitsNeeded')),
                    city: formData.get('city') || null,
                    message: formData.get('message') || null
                  })
                });
                await loadMyEmergency();
                setMessage('Emergency request created.');
                setMessageError(false);
                event.currentTarget.reset();
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Emergency Group
              <select name="bloodGroup" required>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>Units Needed
              <input type="number" name="unitsNeeded" min="1" required />
            </label>
            <label>City
              <input type="text" name="city" />
            </label>
            <label>Message
              <input type="text" name="message" />
            </label>
            <button type="submit" className="btn secondary">Send Emergency Request</button>
          </form>

          <div className="split">
            <div>
              <h3>My Bookings</h3>
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await loadMyBookings();
                    setMessage('Bookings refreshed.');
                    setMessageError(false);
                  } catch (error) {
                    setMessage(error.message);
                    setMessageError(true);
                  }
                }}
              >
                Refresh
              </button>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Bank</th>
                      <th>Group</th>
                      <th>Units</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myBookings.length === 0 ? (
                      <tr><td colSpan="6">No bookings found.</td></tr>
                    ) : (
                      myBookings.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.bank_name}</td>
                          <td>{row.blood_group}</td>
                          <td>{row.units_required}</td>
                          <td>{row.status}</td>
                          <td>
                            {row.status === 'pending' ? (
                              <button
                                className="btn danger"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/bookings/${row.id}/cancel`, { method: 'PUT' });
                                    await loadMyBookings();
                                    setMessage('Booking canceled.');
                                    setMessageError(false);
                                  } catch (error) {
                                    setMessage(error.message);
                                    setMessageError(true);
                                  }
                                }}
                              >
                                Cancel
                              </button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3>My Emergency Requests</h3>
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await loadMyEmergency();
                    setMessage('Emergency list refreshed.');
                    setMessageError(false);
                  } catch (error) {
                    setMessage(error.message);
                    setMessageError(true);
                  }
                }}
              >
                Refresh
              </button>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>City</th>
                      <th>Group</th>
                      <th>Units</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myEmergency.length === 0 ? (
                      <tr><td colSpan="6">No emergency requests found.</td></tr>
                    ) : (
                      myEmergency.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.city || '-'}</td>
                          <td>{row.blood_group}</td>
                          <td>{row.units_needed}</td>
                          <td>{row.status}</td>
                          <td>
                            {row.status === 'open' ? (
                              <button
                                className="btn secondary"
                                onClick={async () => {
                                  try {
                                    await apiRequest(`/api/emergency-requests/${row.id}/close`, { method: 'PUT' });
                                    await loadMyEmergency();
                                    setMessage('Emergency request closed.');
                                    setMessageError(false);
                                  } catch (error) {
                                    setMessage(error.message);
                                    setMessageError(true);
                                  }
                                }}
                              >
                                Close
                              </button>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {user?.role === 'donor' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Donor Module</p>
              <h2>Respond to Requests</h2>
            </div>
            <span className="tag">Availability status</span>
          </div>
          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await apiRequest('/api/donor/availability', {
                  method: 'PUT',
                  body: JSON.stringify({ isAvailable: availability === 'true' })
                });
                setMessage('Availability updated.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Availability
              <select value={availability} onChange={(event) => setAvailability(event.target.value)}>
                <option value="true">Available</option>
                <option value="false">Not Available</option>
              </select>
            </label>
            <button type="submit" className="btn">Update</button>
          </form>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await loadDonorRequests();
                setMessage('Donor requests refreshed.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            Load Requests
          </button>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Requester</th>
                  <th>City</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Response</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {donorRequests.length === 0 ? (
                  <tr><td colSpan="7">No donor requests found.</td></tr>
                ) : (
                  donorRequests.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.requester_name}</td>
                      <td>{row.city || row.requester_city || '-'}</td>
                      <td>{row.blood_group}</td>
                      <td>{row.units_needed}</td>
                      <td>{row.donor_response_status || 'not responded'}</td>
                      <td>
                        {row.donor_response_status === 'accepted' ? (
                          <button
                            className="btn danger"
                            onClick={async () => {
                              try {
                                await apiRequest(`/api/donor/requests/${row.id}/withdraw`, { method: 'PUT' });
                                await loadDonorRequests();
                                setMessage('Donor response updated.');
                                setMessageError(false);
                              } catch (error) {
                                setMessage(error.message);
                                setMessageError(true);
                              }
                            }}
                          >
                            Withdraw
                          </button>
                        ) : (
                          <button
                            className="btn"
                            onClick={async () => {
                              try {
                                const note = window.prompt('Optional note for requester:', '') || '';
                                await apiRequest(`/api/donor/requests/${row.id}/respond`, {
                                  method: 'POST',
                                  body: JSON.stringify({ note: note || null })
                                });
                                await loadDonorRequests();
                                setMessage('Donor response updated.');
                                setMessageError(false);
                              } catch (error) {
                                setMessage(error.message);
                                setMessageError(true);
                              }
                            }}
                          >
                            Respond
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
      )}

      {user?.role === 'blood_bank' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Blood Bank Module</p>
              <h2>Manage Stock</h2>
            </div>
            <span className="tag">Approvals + inventory</span>
          </div>
          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              try {
                await apiRequest(`/api/blood-bank/stock/${encodeURIComponent(formData.get('bloodGroup'))}`, {
                  method: 'PUT',
                  body: JSON.stringify({ units: Number(formData.get('units')) })
                });
                await Promise.all([loadBankStock(), loadBankLowStock()]);
                setMessage('Stock updated.');
                setMessageError(false);
                event.currentTarget.reset();
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Blood Group
              <select name="bloodGroup" required>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            <label>Units
              <input type="number" name="units" min="0" required />
            </label>
            <button type="submit" className="btn">Update Stock</button>
          </form>

          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await loadBankStock();
                setMessage('Stock loaded.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            Load Stock
          </button>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {stock.length === 0 ? (
                  <tr><td colSpan="3">No stock entries found.</td></tr>
                ) : (
                  stock.map((row) => (
                    <tr key={row.blood_group}>
                      <td>{row.blood_group}</td>
                      <td>{row.units_available}</td>
                      <td>{new Date(row.updated_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Pending Bookings</h3>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await loadBankBookings();
                setMessage('Booking requests loaded.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            Load Booking Requests
          </button>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>User</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {bankBookings.length === 0 ? (
                  <tr><td colSpan="6">No pending bookings.</td></tr>
                ) : (
                  bankBookings.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.user_name}</td>
                      <td>{row.blood_group}</td>
                      <td>{row.units_required}</td>
                      <td>{row.status}</td>
                      <td>
                        <button
                          className="btn"
                          onClick={async () => {
                            try {
                              await apiRequest(`/api/blood-bank/bookings/${row.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'approved', reason: null })
                              });
                              await Promise.all([loadBankBookings(), loadBankStock(), loadBankLowStock()]);
                              setMessage('Booking approved.');
                              setMessageError(false);
                            } catch (error) {
                              setMessage(error.message);
                              setMessageError(true);
                            }
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="btn danger"
                          onClick={async () => {
                            const reason = window.prompt('Reason for rejection (optional):', '') || null;
                            try {
                              await apiRequest(`/api/blood-bank/bookings/${row.id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ status: 'rejected', reason })
                              });
                              await Promise.all([loadBankBookings(), loadBankStock(), loadBankLowStock()]);
                              setMessage('Booking rejected.');
                              setMessageError(false);
                            } catch (error) {
                              setMessage(error.message);
                              setMessageError(true);
                            }
                          }}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h3>Low Stock</h3>
          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await loadBankLowStock();
                setMessage('Low stock report updated.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Threshold
              <input
                type="number"
                min="0"
                value={bankThreshold}
                onChange={(event) => setBankThreshold(Number(event.target.value || 0))}
              />
            </label>
            <button type="submit" className="btn secondary">Check</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {bankLowStock.length === 0 ? (
                  <tr><td colSpan="3">No low stock entries.</td></tr>
                ) : (
                  bankLowStock.map((row) => (
                    <tr key={row.blood_group}>
                      <td>{row.blood_group}</td>
                      <td>{row.units_available}</td>
                      <td>{new Date(row.updated_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {user?.role === 'admin' && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Admin Module</p>
              <h2>System Control</h2>
            </div>
            <span className="tag">Monitoring + reports</span>
          </div>
          <button
            className="btn secondary"
            onClick={async () => {
              try {
                await loadAdminStatsAndLowStock();
                setMessage('Admin stats loaded.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            Load System Stats
          </button>
          <StatGrid items={adminStats} />

          <h3>Low Stock Across Banks</h3>
          <form
            className="form inline"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await loadAdminStatsAndLowStock();
                setMessage('Low stock report updated.');
                setMessageError(false);
              } catch (error) {
                setMessage(error.message);
                setMessageError(true);
              }
            }}
          >
            <label>Threshold
              <input
                type="number"
                min="0"
                value={adminThreshold}
                onChange={(event) => setAdminThreshold(Number(event.target.value || 0))}
              />
            </label>
            <button type="submit" className="btn">Check</button>
          </form>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>City</th>
                  <th>Group</th>
                  <th>Units</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {adminLowStock.length === 0 ? (
                  <tr><td colSpan="5">No low stock alerts.</td></tr>
                ) : (
                  adminLowStock.map((row, index) => (
                    <tr key={`${row.bank_id}-${row.blood_group}-${index}`}>
                      <td>{row.bank_name}</td>
                      <td>{row.bank_city}</td>
                      <td>{row.blood_group}</td>
                      <td>{row.units_available}</td>
                      <td>{row.bank_contact}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="message" aria-live="polite" style={{ color: messageError ? '#8b0000' : '#1c3f5e' }}>
        {message}
      </p>
    </AppShell>
  );
}

