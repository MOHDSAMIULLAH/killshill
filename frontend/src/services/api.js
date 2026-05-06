/**
 * All API calls use the Vite dev proxy (/api → http://localhost:3001).
 * For production, set VITE_API_URL to your backend origin.
 */
const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed');
    err.errors = data.errors || [];
    err.status = res.status;
    throw err;
  }
  return data.data;
}

const api = {
  getSignals: () => request('/api/signals'),

  getSignalById: (id) => request(`/api/signals/${id}`),

  getSignalStatus: (id) => request(`/api/signals/${id}/status`),

  createSignal: (payload) =>
    request('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  deleteSignal: (id) => request(`/api/signals/${id}`, { method: 'DELETE' }),
};

export default api;
