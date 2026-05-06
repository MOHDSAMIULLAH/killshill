import { useState } from 'react';
import api from '../services/api.js';

const EMPTY_FORM = {
  symbol: '',
  direction: 'BUY',
  entry_price: '',
  stop_loss: '',
  target_price: '',
  entry_time: '',
  expiry_time: '',
};

function validate(form) {
  const errs = {};
  const { symbol, direction, entry_price, stop_loss, target_price, entry_time, expiry_time } = form;

  if (!symbol.trim()) errs.symbol = 'Symbol is required';

  const ep = parseFloat(entry_price);
  const sl = parseFloat(stop_loss);
  const tp = parseFloat(target_price);

  if (!entry_price || isNaN(ep) || ep <= 0) errs.entry_price = 'Enter a positive entry price';
  if (!stop_loss  || isNaN(sl) || sl <= 0) errs.stop_loss   = 'Enter a positive stop loss';
  if (!target_price || isNaN(tp) || tp <= 0) errs.target_price = 'Enter a positive target price';

  if (!isNaN(ep) && !isNaN(sl) && !isNaN(tp)) {
    if (direction === 'BUY') {
      if (sl >= ep) errs.stop_loss   = 'BUY: stop loss must be below entry price';
      if (tp <= ep) errs.target_price = 'BUY: target must be above entry price';
    } else {
      if (sl <= ep) errs.stop_loss   = 'SELL: stop loss must be above entry price';
      if (tp >= ep) errs.target_price = 'SELL: target must be below entry price';
    }
  }

  if (!entry_time) {
    errs.entry_time = 'Entry time is required';
  } else {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (new Date(entry_time) < cutoff) {
      errs.entry_time = 'Entry time cannot be more than 24 hours in the past';
    }
  }

  if (!expiry_time) {
    errs.expiry_time = 'Expiry time is required';
  } else if (entry_time && new Date(expiry_time) <= new Date(entry_time)) {
    errs.expiry_time = 'Expiry must be after entry time';
  }

  return errs;
}

export default function SignalForm({ onSignalCreated }) {
  const [form, setForm]           = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess]     = useState(false);
  const [loading, setLoading]     = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSuccess(false);

    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await api.createSignal({
        symbol:       form.symbol.trim().toUpperCase(),
        direction:    form.direction,
        entry_price:  parseFloat(form.entry_price),
        stop_loss:    parseFloat(form.stop_loss),
        target_price: parseFloat(form.target_price),
        // Convert datetime-local (local time) to ISO string
        entry_time:   new Date(form.entry_time).toISOString(),
        expiry_time:  new Date(form.expiry_time).toISOString(),
      });
      setForm(EMPTY_FORM);
      setFieldErrors({});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      onSignalCreated();
    } catch (err) {
      const msgs = err.errors?.length ? err.errors.join(' · ') : err.message;
      setSubmitError(msgs || 'Failed to create signal');
    } finally {
      setLoading(false);
    }
  }

  const f = (name) => ({
    name,
    value: form[name],
    onChange: handleChange,
    className: fieldErrors[name] ? 'is-error' : '',
  });

  return (
    <div className="card">
      <h2 className="card-title">Create Signal</h2>

      <form className="signal-form" onSubmit={handleSubmit} noValidate>

        {/* Row 1: symbol + direction */}
        <div className="form-row">
          <div className="form-group" style={{ minWidth: '160px' }}>
            <label htmlFor="symbol">Trading Pair</label>
            <input
              id="symbol"
              type="text"
              placeholder="e.g. BTCUSDT"
              {...f('symbol')}
            />
            {fieldErrors.symbol && <span className="field-error">{fieldErrors.symbol}</span>}
          </div>

          <div className="form-group" style={{ maxWidth: '120px' }}>
            <label htmlFor="direction">Direction</label>
            <select id="direction" {...f('direction')}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
        </div>

        {/* Row 2: prices */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="entry_price">Entry Price</label>
            <input id="entry_price" type="number" step="any" min="0" placeholder="0.00" {...f('entry_price')} />
            {fieldErrors.entry_price && <span className="field-error">{fieldErrors.entry_price}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="stop_loss">Stop Loss</label>
            <input id="stop_loss" type="number" step="any" min="0" placeholder="0.00" {...f('stop_loss')} />
            {fieldErrors.stop_loss && <span className="field-error">{fieldErrors.stop_loss}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="target_price">Target Price</label>
            <input id="target_price" type="number" step="any" min="0" placeholder="0.00" {...f('target_price')} />
            {fieldErrors.target_price && <span className="field-error">{fieldErrors.target_price}</span>}
          </div>
        </div>

        {/* Row 3: times */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="entry_time">Entry Date &amp; Time</label>
            <input id="entry_time" type="datetime-local" {...f('entry_time')} />
            {fieldErrors.entry_time && <span className="field-error">{fieldErrors.entry_time}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="expiry_time">Expiry Date &amp; Time</label>
            <input id="expiry_time" type="datetime-local" {...f('expiry_time')} />
            {fieldErrors.expiry_time && <span className="field-error">{fieldErrors.expiry_time}</span>}
          </div>
        </div>

        {submitError && <div className="alert alert-error">{submitError}</div>}
        {success    && <div className="alert alert-success">Signal created successfully!</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating…' : 'Create Signal'}
        </button>
      </form>
    </div>
  );
}
