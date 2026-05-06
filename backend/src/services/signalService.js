const signalModel = require('../models/signalModel');
const binanceService = require('./binanceService');

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCreateSignal(data) {
  const errors = [];
  const { symbol, direction, entry_price, stop_loss, target_price, entry_time, expiry_time } = data;

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    errors.push('symbol is required');
  }

  const dir = (direction || '').toUpperCase();
  if (!['BUY', 'SELL'].includes(dir)) {
    errors.push('direction must be BUY or SELL');
  }

  const ep = parseFloat(entry_price);
  const sl = parseFloat(stop_loss);
  const tp = parseFloat(target_price);

  if (isNaN(ep) || ep <= 0) errors.push('entry_price must be a positive number');
  if (isNaN(sl) || sl <= 0) errors.push('stop_loss must be a positive number');
  if (isNaN(tp) || tp <= 0) errors.push('target_price must be a positive number');

  if (!isNaN(ep) && !isNaN(sl) && !isNaN(tp) && ['BUY', 'SELL'].includes(dir)) {
    if (dir === 'BUY') {
      if (sl >= ep) errors.push('For BUY direction: stop_loss must be less than entry_price');
      if (tp <= ep) errors.push('For BUY direction: target_price must be greater than entry_price');
    } else {
      if (sl <= ep) errors.push('For SELL direction: stop_loss must be greater than entry_price');
      if (tp >= ep) errors.push('For SELL direction: target_price must be less than entry_price');
    }
  }

  if (!entry_time) {
    errors.push('entry_time is required');
  } else {
    const entryDate = new Date(entry_time);
    if (isNaN(entryDate.getTime())) {
      errors.push('entry_time must be a valid datetime');
    } else {
      // Allow entry times up to 24 hours in the past (historical signals)
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (entryDate < cutoff) {
        errors.push('entry_time cannot be more than 24 hours in the past');
      }
    }
  }

  if (!expiry_time) {
    errors.push('expiry_time is required');
  } else {
    const expiryDate = new Date(expiry_time);
    if (isNaN(expiryDate.getTime())) {
      errors.push('expiry_time must be a valid datetime');
    } else if (entry_time) {
      const entryDate = new Date(entry_time);
      if (!isNaN(entryDate.getTime()) && expiryDate <= entryDate) {
        errors.push('expiry_time must be after entry_time');
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Business logic helpers
// ---------------------------------------------------------------------------

function calculateROI(direction, entryPrice, currentPrice) {
  const entry = parseFloat(entryPrice);
  const current = parseFloat(currentPrice);
  if (direction === 'BUY') {
    return ((current - entry) / entry) * 100;
  }
  return ((entry - current) / entry) * 100;
}

/**
 * Check price-based status transitions (does NOT check expiry).
 */
function evaluatePriceStatus(direction, stopLoss, targetPrice, currentPrice) {
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(targetPrice);
  const cp = parseFloat(currentPrice);

  if (direction === 'BUY') {
    if (cp >= tp) return 'TARGET_HIT';
    if (cp <= sl) return 'STOPLOSS_HIT';
  } else {
    if (cp <= tp) return 'TARGET_HIT';
    if (cp >= sl) return 'STOPLOSS_HIT';
  }
  return 'OPEN';
}

function getTimeRemaining(expiryTime) {
  const ms = new Date(expiryTime) - new Date();
  if (ms <= 0) return 'Expired';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * Attach live-data fields (current_price, roi, time_remaining) to a signal
 * that is already in a terminal state (TARGET_HIT / STOPLOSS_HIT / EXPIRED).
 */
function enrichResolvedSignal(signal, currentPrice) {
  return {
    ...signal,
    entry_price: parseFloat(signal.entry_price),
    stop_loss: parseFloat(signal.stop_loss),
    target_price: parseFloat(signal.target_price),
    realized_roi: signal.realized_roi !== null ? parseFloat(signal.realized_roi) : null,
    current_price: currentPrice,
    roi: signal.realized_roi !== null ? parseFloat(signal.realized_roi).toFixed(2) : null,
    time_remaining: signal.status === 'EXPIRED' ? 'Expired' : 'N/A',
  };
}

/**
 * Attach live-data fields to an OPEN signal (no status change).
 */
function enrichOpenSignal(signal, currentPrice) {
  const roi =
    currentPrice !== null
      ? calculateROI(signal.direction, signal.entry_price, currentPrice).toFixed(2)
      : null;
  return {
    ...signal,
    entry_price: parseFloat(signal.entry_price),
    stop_loss: parseFloat(signal.stop_loss),
    target_price: parseFloat(signal.target_price),
    realized_roi: null,
    current_price: currentPrice,
    roi,
    time_remaining: getTimeRemaining(signal.expiry_time),
  };
}

/**
 * Evaluate and persist status for an OPEN signal, then return the enriched record.
 * Expiry takes priority — an expired signal is never re-evaluated against price.
 */
async function processOpenSignal(signal, currentPrice) {
  const now = new Date();
  const expiry = new Date(signal.expiry_time);

  // 1. Expiry check (highest priority)
  if (now >= expiry) {
    const roiValue =
      currentPrice !== null
        ? parseFloat(calculateROI(signal.direction, signal.entry_price, currentPrice).toFixed(4))
        : null;
    const updated = await signalModel.updateStatus(signal.id, 'EXPIRED', roiValue);
    return enrichResolvedSignal(updated, currentPrice);
  }

  // 2. Price-based check
  if (currentPrice !== null) {
    const newStatus = evaluatePriceStatus(
      signal.direction,
      signal.stop_loss,
      signal.target_price,
      currentPrice
    );
    if (newStatus !== 'OPEN') {
      const roiValue = parseFloat(
        calculateROI(signal.direction, signal.entry_price, currentPrice).toFixed(4)
      );
      const updated = await signalModel.updateStatus(signal.id, newStatus, roiValue);
      return enrichResolvedSignal(updated, currentPrice);
    }
  }

  return enrichOpenSignal(signal, currentPrice);
}

// ---------------------------------------------------------------------------
// Service API
// ---------------------------------------------------------------------------

const signalService = {
  async createSignal(data) {
    const errors = validateCreateSignal(data);
    if (errors.length > 0) {
      const err = new Error('Validation failed');
      err.statusCode = 400;
      err.errors = errors;
      throw err;
    }

    const normalized = {
      symbol: data.symbol.trim().toUpperCase(),
      direction: data.direction.toUpperCase(),
      entry_price: parseFloat(data.entry_price),
      stop_loss: parseFloat(data.stop_loss),
      target_price: parseFloat(data.target_price),
      entry_time: new Date(data.entry_time).toISOString(),
      expiry_time: new Date(data.expiry_time).toISOString(),
    };

    return signalModel.create(normalized);
  },

  async getAllSignals() {
    const signals = await signalModel.findAll();
    if (signals.length === 0) return [];

    // Batch-fetch live prices for all unique symbols
    const uniqueSymbols = [...new Set(signals.map((s) => s.symbol))];
    let priceMap = {};
    try {
      priceMap = await binanceService.getPrices(uniqueSymbols);
    } catch (err) {
      console.error('Binance batch price fetch failed:', err.message);
    }

    return Promise.all(
      signals.map((signal) => {
        const currentPrice = priceMap[signal.symbol] ?? null;
        if (signal.status === 'OPEN') {
          return processOpenSignal(signal, currentPrice);
        }
        return enrichResolvedSignal(signal, currentPrice);
      })
    );
  },

  async getSignalById(id) {
    const signal = await signalModel.findById(id);
    if (!signal) {
      const err = new Error(`Signal ${id} not found`);
      err.statusCode = 404;
      throw err;
    }

    let currentPrice = null;
    try {
      currentPrice = await binanceService.getPrice(signal.symbol);
    } catch (err) {
      console.error('Binance price fetch failed:', err.message);
    }

    if (signal.status === 'OPEN') {
      return processOpenSignal(signal, currentPrice);
    }
    return enrichResolvedSignal(signal, currentPrice);
  },

  async getSignalStatus(id) {
    const signal = await this.getSignalById(id);
    return {
      id: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      status: signal.status,
      current_price: signal.current_price,
      roi: signal.roi,
      time_remaining: signal.time_remaining,
    };
  },

  async deleteSignal(id) {
    const deleted = await signalModel.remove(id);
    if (!deleted) {
      const err = new Error(`Signal ${id} not found`);
      err.statusCode = 404;
      throw err;
    }
    return deleted;
  },
};

module.exports = signalService;
