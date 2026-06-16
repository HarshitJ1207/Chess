const BASE = {
  auth: '/api/auth',
  matchmaking: '/api/matchmaking',
  ratings: '/api/ratings',
  history: '/api/history',
};

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    ...rest,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || res.statusText), { status: res.status, data });
  return data;
}

export const api = {
  register: (body) => request(`${BASE.auth}/register`, { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request(`${BASE.auth}/login`, { method: 'POST', body: JSON.stringify(body) }),
  loginAnonymous: () => request(`${BASE.auth}/anonymous`, { method: 'POST' }),

  queue: (body, token) => request(`${BASE.matchmaking}/queue`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }),

  dequeue: (timeControl, token) => request(`${BASE.matchmaking}/dequeue?timeControl=${encodeURIComponent(timeControl)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  }),

  getRating: (username, token) => request(`${BASE.ratings}/${username}`, {
    headers: authHeaders(token),
  }),

  getLeaderboard: (token) => request(`${BASE.ratings}/leaderboard`, {
    headers: authHeaders(token),
  }),

  getHistory: (username, page = 0, size = 20, token) => request(
    `${BASE.history}/player/${username}?page=${page}&size=${size}`,
    { headers: authHeaders(token) },
  ),

  getGame: (gameId, token) => request(`${BASE.history}/game/${gameId}`, {
    headers: authHeaders(token),
  }),
};
