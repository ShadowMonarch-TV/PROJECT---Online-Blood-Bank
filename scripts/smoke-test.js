async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${data.error || 'Request failed'}`);
  }
  return data;
}

async function run() {
  const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8000';

  const health = await requestJson(`${base}/api/health`);
  if (health.status !== 'ok') throw new Error('Health check failed');

  const adminLogin = await requestJson(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bloodbank.com', password: 'Admin@123' })
  });

  const search = await requestJson(`${base}/api/blood/search?group=O%2B&city=Bengaluru`);
  if (!Array.isArray(search.results) || search.results.length < 1) {
    throw new Error('Search results are empty unexpectedly');
  }

  const compatibility = await requestJson(`${base}/api/meta/compatibility/O+`);
  if (!compatibility.compatibility || !Array.isArray(compatibility.compatibility.canReceiveFrom)) {
    throw new Error('Compatibility endpoint shape invalid');
  }

  const unique = Date.now();
  const donorEmail = `donor${unique}@example.com`;
  const userEmail = `user${unique}@example.com`;

  const donorRegister = await requestJson(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke Donor',
      email: donorEmail,
      password: 'Donor@123',
      role: 'donor',
      bloodGroup: 'O+',
      city: 'Bengaluru'
    })
  });

  await requestJson(`${base}/api/donor/availability`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${donorRegister.token}`
    },
    body: JSON.stringify({ isAvailable: true })
  });

  const userRegister = await requestJson(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Smoke User',
      email: userEmail,
      password: 'User@123',
      role: 'user',
      bloodGroup: 'O+',
      city: 'Bengaluru'
    })
  });

  const alertSubscription = await requestJson(`${base}/api/alerts/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ bloodGroup: 'O+', city: 'Bengaluru' })
  });

  const myAlerts = await requestJson(`${base}/api/alerts/my`, {
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });
  if (!Array.isArray(myAlerts.subscriptions) || myAlerts.subscriptions.length < 1) {
    throw new Error('Alert subscription was not created');
  }

  const alertId = alertSubscription.subscription.id;

  const bankLogin = await requestJson(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'citycare@bloodbank.com', password: 'Bank@123' })
  });

  await requestJson(`${base}/api/blood-bank/stock/O%2B`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bankLogin.token}`
    },
    body: JSON.stringify({ units: 19 })
  });

  const userNotifications = await requestJson(`${base}/api/notifications/my`, {
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });
  if (!userNotifications.notifications.some((n) => String(n.title).includes('Stock alert'))) {
    throw new Error('Expected stock alert notification for subscribed user');
  }

  await requestJson(`${base}/api/alerts/${alertId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ isActive: false })
  });

  await requestJson(`${base}/api/alerts/${alertId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ isActive: true })
  });

  await requestJson(`${base}/api/alerts/${alertId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });

  const myAlertsAfterDelete = await requestJson(`${base}/api/alerts/my`, {
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });
  if (myAlertsAfterDelete.subscriptions.some((row) => row.id === alertId)) {
    throw new Error('Alert subscription was not deleted');
  }

  await requestJson(`${base}/api/favorites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ bankId: search.results[0].bank_id })
  });

  const favorites = await requestJson(`${base}/api/favorites/my`, {
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });
  if (!Array.isArray(favorites.favorites) || favorites.favorites.length < 1) {
    throw new Error('Favorites flow failed');
  }

  await requestJson(`${base}/api/favorites/${search.results[0].bank_id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });

  const emergencyCreate = await requestJson(`${base}/api/emergency-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ bloodGroup: 'O+', unitsNeeded: 1, city: 'Bengaluru', message: 'Smoke test' })
  });

  const bookingCreate = await requestJson(`${base}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({
      bankId: search.results[0].bank_id,
      bloodGroup: 'O+',
      unitsRequired: 1
    })
  });

  await requestJson(`${base}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ name: 'Smoke User Updated', city: 'Bengaluru' })
  });

  await requestJson(`${base}/api/auth/change-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userRegister.token}`
    },
    body: JSON.stringify({ currentPassword: 'User@123', newPassword: 'User@1234' })
  });

  await requestJson(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, password: 'User@1234' })
  });

  const donorUnread = await requestJson(`${base}/api/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${donorRegister.token}` }
  });
  if (donorUnread.unread < 1) {
    throw new Error('Expected at least one donor notification');
  }

  await requestJson(`${base}/api/donor/requests/${emergencyCreate.request.id}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${donorRegister.token}`
    },
    body: JSON.stringify({ note: 'I can donate now.' })
  });

  const responseFeed = await requestJson(`${base}/api/emergency-requests/my/responses`, {
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });
  if (!Array.isArray(responseFeed.responses) || responseFeed.responses.length < 1) {
    throw new Error('Expected donor responses in user feed');
  }

  await requestJson(`${base}/api/bookings/${bookingCreate.booking.id}/cancel`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${userRegister.token}` }
  });

  const adminStats = await requestJson(`${base}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  });
  if (!adminStats.stats || typeof adminStats.stats.users !== 'number') {
    throw new Error('Admin stats shape invalid');
  }

  const adminLowStock = await requestJson(`${base}/api/admin/low-stock?threshold=5`, {
    headers: { Authorization: `Bearer ${adminLogin.token}` }
  });
  if (!Array.isArray(adminLowStock.lowStock)) {
    throw new Error('Admin low-stock endpoint shape invalid');
  }

  const bankLowStock = await requestJson(`${base}/api/blood-bank/low-stock?threshold=5`, {
    headers: { Authorization: `Bearer ${bankLogin.token}` }
  });
  if (!Array.isArray(bankLowStock.lowStock)) {
    throw new Error('Blood bank low-stock endpoint shape invalid');
  }

  console.log('Smoke test passed.');
}

run().catch((error) => {
  console.error('Smoke test failed:', error.message);
  process.exitCode = 1;
});

