import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicRequest, setToken } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, bloodGroups, refreshUser } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [role, setRole] = useState('user');

  useEffect(() => {
    document.body.classList.add('landing-page');
    return () => {
      document.body.classList.remove('landing-page');
    };
  }, []);

  const isBank = role === 'blood_bank';
  const isDonor = role === 'donor';
  const showDashboard = !!user;

  const bloodGroupOptions = useMemo(
    () => bloodGroups.map((group) => (
      <option key={group} value={group}>
        {group}
      </option>
    )),
    [bloodGroups]
  );

  function showMessage(text, isError = false) {
    setMessage(text);
    setMessageError(isError);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const data = await publicRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.get('email'),
          password: formData.get('password')
        })
      });

      setToken(data.token);
      await refreshUser();
      showMessage('Login successful. Redirecting to dashboard...', false);
      setTimeout(() => navigate('/dashboard'), 350);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const data = await publicRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone') || null,
          password: formData.get('password'),
          role: formData.get('role'),
          bloodGroup: formData.get('bloodGroup') || null,
          city: formData.get('city') || null,
          bankName: formData.get('bankName') || null,
          bankAddress: formData.get('bankAddress') || null,
          bankContact: formData.get('bankContact') || null
        })
      });

      setToken(data.token);
      await refreshUser();
      showMessage('Registration successful. Redirecting to dashboard...', false);
      setTimeout(() => navigate('/dashboard'), 350);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const group = formData.get('group');
    const city = formData.get('city');

    const query = new URLSearchParams();
    if (group) query.set('group', group);
    if (city) query.set('city', String(city).trim());

    try {
      const data = await publicRequest(`/api/blood/search?${query.toString()}`);
      setSearchResults(data.results || []);
      showMessage(`Found ${data.results.length} matching stock records.`, false);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  return (
    <>
      <div className="page-ambient"></div>

      <header className="landing-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"></span>
          <div>
            <span className="brand-title">CrimsonNet</span>
            <span className="brand-subtitle">Smart Blood Network</span>
          </div>
        </div>
        {showDashboard && (
          <button className="btn ghost" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        )}
      </header>

      <main className="landing-shell container">
        <section className="hero-panel">
          <p className="eyebrow">Emergency Ready Platform</p>
          <h1>Book blood faster. Coordinate donors instantly.</h1>
          <p>
            CrimsonNet keeps patients, donors, and blood banks in sync with live availability, instant
            booking, and verified requests.
          </p>
          <div className="tag-row">
            <span className="tag">Live Stock</span>
            <span className="tag">Verified Donors</span>
            <span className="tag">Rapid Approvals</span>
          </div>
        </section>

        <section className="auth-grid">
          <article className="card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Access</p>
                <h2>Login</h2>
              </div>
              <span className="tag">Existing Users</span>
            </div>
            <form className="form" onSubmit={handleLogin}>
              <label>Email
                <input type="email" name="email" required />
              </label>
              <label>Password
                <input type="password" name="password" required />
              </label>
              <button type="submit" className="btn">Login</button>
            </form>
          </article>

          <article className="card">
            <div className="panel-header">
              <div>
                <p className="eyebrow">New Account</p>
                <h2>Register</h2>
              </div>
              <span className="tag">Join Network</span>
            </div>
            <form className="form" onSubmit={handleRegister}>
              <label>Name
                <input type="text" name="name" required />
              </label>
              <label>Email
                <input type="email" name="email" required />
              </label>
              <label>Phone
                <input type="text" name="phone" placeholder="10-digit phone" />
              </label>
              <label>Password
                <input type="password" name="password" required />
              </label>
              <label>Role
                <select name="role" value={role} onChange={(event) => setRole(event.target.value)} required>
                  <option value="user">Patient / User</option>
                  <option value="donor">Donor</option>
                  <option value="blood_bank">Blood Bank</option>
                </select>
              </label>
              <label>Blood Group
                <select name="bloodGroup" required={isDonor}>
                  <option value="">Select blood group</option>
                  {bloodGroupOptions}
                </select>
              </label>
              <label>City
                <input type="text" name="city" placeholder="Your city" />
              </label>

              {isBank && (
                <div>
                  <label>Blood Bank Name
                    <input type="text" name="bankName" required={isBank} />
                  </label>
                  <label>Blood Bank Address
                    <input type="text" name="bankAddress" required={isBank} />
                  </label>
                  <label>Blood Bank Contact
                    <input type="text" name="bankContact" required={isBank} />
                  </label>
                </div>
              )}

              <button type="submit" className="btn">Create Account</button>
            </form>
          </article>
        </section>

        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Availability</p>
              <h2>Search Blood Stock</h2>
            </div>
            <span className="tag">Updated in real time</span>
          </div>
          <form className="form inline" onSubmit={handleSearch}>
            <label>Blood Group
              <select name="group">
                <option value="">All</option>
                {bloodGroupOptions}
              </select>
            </label>
            <label>City
              <input type="text" name="city" placeholder="e.g., Bengaluru" />
            </label>
            <button type="submit" className="btn">Search</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Blood Bank</th>
                  <th>City</th>
                  <th>Blood Group</th>
                  <th>Units Available</th>
                  <th>Contact</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.length === 0 ? (
                  <tr><td colSpan="5">No records found.</td></tr>
                ) : (
                  searchResults.map((row) => (
                    <tr key={`${row.bank_id}-${row.blood_group}`}>
                      <td>{row.bank_name} (ID: {row.bank_id})</td>
                      <td>{row.city}</td>
                      <td>{row.blood_group}</td>
                      <td>{row.units_available}</td>
                      <td>{row.contact}</td>
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
      </main>
    </>
  );
}

