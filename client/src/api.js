const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function getToken() {
  return localStorage.getItem('bloodbank_token');
}

export function setToken(token) {
  localStorage.setItem('bloodbank_token', token);
}

export function clearToken() {
  localStorage.removeItem('bloodbank_token');
}

async function request(url, options = {}, withAuth = false) {
  const headers = {
    ...JSON_HEADERS,
    ...((options && options.headers) || {})
  };

  if (withAuth) {
    const token = getToken();
    if (!token) {
      throw new Error('Authentication required.');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...(options || {}),
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }

  return data;
}

export function apiRequest(url, options) {
  return request(url, options, true);
}

export function publicRequest(url, options) {
  return request(url, options, false);
}

