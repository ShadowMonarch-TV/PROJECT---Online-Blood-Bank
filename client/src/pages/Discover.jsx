import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { apiRequest, publicRequest } from '../api.js';
import { useApp } from '../context/AppContext.jsx';

const FAVORITES_ALLOWED_ROLES = new Set(['user', 'donor', 'admin']);

export default function DiscoverPage() {
  const { user, bloodGroups, logout } = useApp();
  const [message, setMessage] = useState(null);
  const [messageError, setMessageError] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [searchGroup, setSearchGroup] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [compatibilityGroup, setCompatibilityGroup] = useState('');
  const [compatibility, setCompatibility] = useState(null);

  const canUseFavorites = user && FAVORITES_ALLOWED_ROLES.has(user.role);

  const subtitle = user ? `${user.name} (${user.role}) | ${user.email}` : 'Loading profile...';

  useEffect(() => {
    if (!bloodGroups.length) return;
    if (!compatibilityGroup) setCompatibilityGroup(bloodGroups[0]);
  }, [bloodGroups, compatibilityGroup]);

  async function loadFavorites() {
    if (!canUseFavorites) {
      setFavorites([]);
      setFavoriteIds(new Set());
      return;
    }

    const data = await apiRequest('/api/favorites/my');
    setFavorites(data.favorites || []);
    setFavoriteIds(new Set((data.favorites || []).map((row) => Number(row.bank_id))));
  }

  async function loadSearch() {
    const query = new URLSearchParams();
    if (searchGroup) query.set('group', searchGroup);
    if (searchCity.trim()) query.set('city', searchCity.trim());

    const data = await publicRequest(`/api/blood/search?${query.toString()}`);
    setSearchResults(data.results || []);
  }

  async function loadCompatibility(groupValue) {
    if (!groupValue) return;
    const data = await publicRequest(`/api/meta/compatibility/${encodeURIComponent(groupValue)}`);
    setCompatibility(data);
  }

  async function toggleFavorite(bankId, isFavorite) {
    if (isFavorite) {
      await apiRequest(`/api/favorites/${bankId}`, { method: 'DELETE' });
    } else {
      await apiRequest('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ bankId })
      });
    }

    await loadFavorites();
    await loadSearch();
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await loadSearch();
        if (canUseFavorites) {
          await loadFavorites();
        }
        if (bloodGroups.length) {
          await loadCompatibility(bloodGroups[0]);
        }
        setMessage('Discover page ready.');
        setMessageError(false);
      } catch (error) {
        setMessage(error.message);
        setMessageError(true);
      }
    })();
  }, [user, canUseFavorites, bloodGroups]);

  return (
    <AppShell
      eyebrow="Discover"
      title="Find Blood Availability"
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
            <p className="eyebrow">Search</p>
            <h2>Live Blood Stock</h2>
          </div>
          <span className="tag">Search by group + city</span>
        </div>
        <form
          className="form inline"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await loadSearch();
              setMessage('Search updated.');
              setMessageError(false);
            } catch (error) {
              setMessage(error.message);
              setMessageError(true);
            }
          }}
        >
          <label>Blood Group
            <select value={searchGroup} onChange={(event) => setSearchGroup(event.target.value)}>
              <option value="">All</option>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <label>City
            <input value={searchCity} onChange={(event) => setSearchCity(event.target.value)} placeholder="City name" />
          </label>
          <button type="submit" className="btn">Search</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Blood Bank</th>
                <th>City</th>
                <th>Group</th>
                <th>Units</th>
                <th>Contact</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.length === 0 ? (
                <tr><td colSpan="6">No data found.</td></tr>
              ) : (
                searchResults.map((row) => {
                  const isFavorite = favoriteIds.has(Number(row.bank_id));
                  return (
                    <tr key={`${row.bank_id}-${row.blood_group}`}>
                      <td>{row.bank_name} (ID: {row.bank_id})</td>
                      <td>{row.city}</td>
                      <td>{row.blood_group}</td>
                      <td>{row.units_available}</td>
                      <td>{row.contact}</td>
                      <td>
                        {canUseFavorites ? (
                          <button
                            className="btn secondary"
                            onClick={() => toggleFavorite(Number(row.bank_id), isFavorite)}
                          >
                            {isFavorite ? 'Unfavorite' : 'Favorite'}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Compatibility</p>
            <h2>Blood Group Match</h2>
          </div>
          <span className="tag">Recipient guide</span>
        </div>
        <form
          className="form inline"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await loadCompatibility(compatibilityGroup);
              setMessage('Compatibility loaded.');
              setMessageError(false);
            } catch (error) {
              setMessage(error.message);
              setMessageError(true);
            }
          }}
        >
          <label>Blood Group
            <select value={compatibilityGroup} onChange={(event) => setCompatibilityGroup(event.target.value)}>
              {bloodGroups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn secondary">Check</button>
        </form>
        <div className="compat-result">
          {!compatibility ? (
            'Select a blood group to view compatibility.'
          ) : (
            <>
              <strong>{compatibility.bloodGroup}</strong>
              <div className="tag-row">
                <span>Can receive from:</span>
                {compatibility.compatibility.canReceiveFrom.map((group) => (
                  <span key={`rec-${group}`} className="tag">{group}</span>
                ))}
              </div>
              <div className="tag-row">
                <span>Can donate to:</span>
                {compatibility.compatibility.canDonateTo.map((group) => (
                  <span key={`don-${group}`} className="tag">{group}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {canUseFavorites && (
        <section className="card">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Favorites</p>
              <h2>Saved Blood Banks</h2>
            </div>
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await loadFavorites();
                  setMessage('Favorites refreshed.');
                  setMessageError(false);
                } catch (error) {
                  setMessage(error.message);
                  setMessageError(true);
                }
              }}
            >
              Refresh Favorites
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bank ID</th>
                  <th>Name</th>
                  <th>City</th>
                  <th>Total Units</th>
                  <th>Contact</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {favorites.length === 0 ? (
                  <tr><td colSpan="6">No favorites saved.</td></tr>
                ) : (
                  favorites.map((row) => (
                    <tr key={row.bank_id}>
                      <td>{row.bank_id}</td>
                      <td>{row.bank_name}</td>
                      <td>{row.bank_city}</td>
                      <td>{row.total_units}</td>
                      <td>{row.bank_contact}</td>
                      <td>
                        <button
                          className="btn danger"
                          onClick={() => toggleFavorite(Number(row.bank_id), true)}
                        >
                          Remove
                        </button>
                      </td>
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

