import { useState, useEffect, useCallback } from 'react';
import api from '../services/api.js';

const AUTO_REFRESH_MS = 15_000;

// Compute time remaining client-side so it stays fresh between server fetches
function timeRemaining(expiryTime) {
  const ms = new Date(expiryTime) - new Date();
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const days    = Math.floor(totalSec / 86400);
  const hours   = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0)    return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0)   return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatPrice(val) {
  if (val === null || val === undefined) return '—';
  const num = parseFloat(val);
  // Use up to 8 significant decimal places, trim trailing zeros
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function StatusBadge({ status }) {
  const cls = `status-badge status-${(status || '').toLowerCase()}`;
  const label = (status || '').replace('_', ' ');
  return <span className={cls}>{label}</span>;
}

function ROICell({ roi }) {
  if (roi === null || roi === undefined) return <span>—</span>;
  const num = parseFloat(roi);
  const cls = num >= 0 ? 'roi-positive' : 'roi-negative';
  return <span className={cls}>{num >= 0 ? '+' : ''}{num.toFixed(2)}%</span>;
}

export default function SignalDashboard({ triggerRefresh }) {
  const [signals, setSignals]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchSignals = useCallback(async () => {
    try {
      const data = await api.getSignals();
      setSignals(data);
      setLastRefresh(new Date());
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to fetch signals. Is the server running?');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 15 s
  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  // Immediate refresh when a new signal is created
  useEffect(() => {
    if (triggerRefresh > 0) fetchSignals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRefresh]);

  async function handleDelete(id) {
    if (!window.confirm('Delete this signal?')) return;
    try {
      await api.deleteSignal(id);
      setSignals((prev) => prev.filter((s) => s.id !== id));
    } catch {
      alert('Failed to delete signal.');
    }
  }

  return (
    <div className="card">
      <div className="dashboard-header">
        <h2 className="card-title">Signal Dashboard</h2>
        <div className="dashboard-meta">
          {lastRefresh && (
            <span className="last-refresh">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button className="btn-icon" onClick={fetchSignals} title="Refresh now">
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p className="state-center">Loading signals…</p>
      ) : signals.length === 0 ? (
        <p className="state-center">No signals yet. Create one above.</p>
      ) : (
        <div className="table-wrapper">
          <table className="signal-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Direction</th>
                <th>Entry Price</th>
                <th>Target</th>
                <th>Stop Loss</th>
                <th>Current Price</th>
                <th>Status</th>
                <th>ROI %</th>
                <th>Time Remaining</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {signals.map((sig) => (
                <tr key={sig.id}>
                  <td className="cell-symbol">{sig.symbol}</td>
                  <td>
                    <span className={`direction-badge direction-${sig.direction?.toLowerCase()}`}>
                      {sig.direction}
                    </span>
                  </td>
                  <td className="cell-price">{formatPrice(sig.entry_price)}</td>
                  <td className="cell-price">{formatPrice(sig.target_price)}</td>
                  <td className="cell-price">{formatPrice(sig.stop_loss)}</td>
                  <td className="cell-live-price">{formatPrice(sig.current_price)}</td>
                  <td><StatusBadge status={sig.status} /></td>
                  <td><ROICell roi={sig.roi} /></td>
                  <td className="cell-time">
                    {sig.status === 'EXPIRED' || sig.status !== 'OPEN'
                      ? sig.status === 'EXPIRED' ? 'Expired' : 'N/A'
                      : timeRemaining(sig.expiry_time)}
                  </td>
                  <td>
                    <button className="btn-delete" onClick={() => handleDelete(sig.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="auto-refresh-note">Auto-refreshes every {AUTO_REFRESH_MS / 1000}s</p>
    </div>
  );
}
