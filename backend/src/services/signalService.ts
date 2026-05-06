import { signalModel, Signal } from '../models/signalModel';
import { binanceService } from './binanceService';
import { AppError } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateSignalInput {
  symbol?: unknown;
  direction?: unknown;
  entry_price?: unknown;
  stop_loss?: unknown;
  target_price?: unknown;
  entry_time?: unknown;
  expiry_time?: unknown;
}

export type EnrichedSignal = Omit<Signal, 'entry_price' | 'stop_loss' | 'target_price' | 'realized_roi'> & {
  entry_price: number;
  stop_loss: number;
  target_price: number;
  realized_roi: number | null;
  current_price: number | null;
  roi: string | null;
  time_remaining: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateCreateSignal(data: CreateSignalInput): string[] {
  const errors: string[] = [];
  const { symbol, direction, entry_price, stop_loss, target_price, entry_time, expiry_time } = data;

  if (!symbol || typeof symbol !== 'string' || !symbol.trim()) {
    errors.push('symbol is required');
  }

  const dir = (String(direction || '')).toUpperCase();
  if (!['BUY', 'SELL'].includes(dir)) {
    errors.push('direction must be BUY or SELL');
  }

  const ep = parseFloat(String(entry_price));
  const sl = parseFloat(String(stop_loss));
  const tp = parseFloat(String(target_price));

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
    const entryDate = new Date(String(entry_time));
    if (isNaN(entryDate.getTime())) {
      errors.push('entry_time must be a valid datetime');
    } else {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (entryDate < cutoff) {
        errors.push('entry_time cannot be more than 24 hours in the past');
      }
    }
  }

  if (!expiry_time) {
    errors.push('expiry_time is required');
  } else {
    const expiryDate = new Date(String(expiry_time));
    if (isNaN(expiryDate.getTime())) {
      errors.push('expiry_time must be a valid datetime');
    } else if (entry_time) {
      const entryDate = new Date(String(entry_time));
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

function calculateROI(direction: string, entryPrice: string, currentPrice: number): number {
  const entry = parseFloat(entryPrice);
  if (direction === 'BUY') {
    return ((currentPrice - entry) / entry) * 100;
  }
  return ((entry - currentPrice) / entry) * 100;
}

function evaluatePriceStatus(
  direction: string,
  stopLoss: string,
  targetPrice: string,
  currentPrice: number
): Signal['status'] {
  const sl = parseFloat(stopLoss);
  const tp = parseFloat(targetPrice);

  if (direction === 'BUY') {
    if (currentPrice >= tp) return 'TARGET_HIT';
    if (currentPrice <= sl) return 'STOPLOSS_HIT';
  } else {
    if (currentPrice <= tp) return 'TARGET_HIT';
    if (currentPrice >= sl) return 'STOPLOSS_HIT';
  }
  return 'OPEN';
}

function getTimeRemaining(expiryTime: Date): string {
  const ms = expiryTime.getTime() - Date.now();
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

function enrichResolvedSignal(signal: Signal, currentPrice: number | null): EnrichedSignal {
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

function enrichOpenSignal(signal: Signal, currentPrice: number | null): EnrichedSignal {
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

async function processOpenSignal(signal: Signal, currentPrice: number | null): Promise<EnrichedSignal> {
  const now = new Date();
  const expiry = new Date(signal.expiry_time);

  if (now >= expiry) {
    const roiValue =
      currentPrice !== null
        ? parseFloat(calculateROI(signal.direction, signal.entry_price, currentPrice).toFixed(4))
        : null;
    const updated = await signalModel.updateStatus(signal.id, 'EXPIRED', roiValue);
    return enrichResolvedSignal(updated, currentPrice);
  }

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

export const signalService = {
  async createSignal(data: CreateSignalInput): Promise<Signal> {
    const errors = validateCreateSignal(data);
    if (errors.length > 0) {
      const err = new Error('Validation failed') as AppError;
      err.statusCode = 400;
      err.errors = errors;
      throw err;
    }

    const normalized = {
      symbol: String(data.symbol).trim().toUpperCase(),
      direction: String(data.direction).toUpperCase() as 'BUY' | 'SELL',
      entry_price: String(parseFloat(String(data.entry_price))),
      stop_loss: String(parseFloat(String(data.stop_loss))),
      target_price: String(parseFloat(String(data.target_price))),
      entry_time: new Date(String(data.entry_time)),
      expiry_time: new Date(String(data.expiry_time)),
    };

    return signalModel.create(normalized);
  },

  async getAllSignals(): Promise<EnrichedSignal[]> {
    const allSignals = await signalModel.findAll();
    if (allSignals.length === 0) return [];

    const uniqueSymbols = [...new Set(allSignals.map((s) => s.symbol))];
    let priceMap: Record<string, number> = {};
    try {
      priceMap = await binanceService.getPrices(uniqueSymbols);
    } catch (err: unknown) {
      console.error('Binance batch price fetch failed:', (err as Error).message);
    }

    return Promise.all(
      allSignals.map((signal) => {
        const currentPrice = priceMap[signal.symbol] ?? null;
        if (signal.status === 'OPEN') {
          return processOpenSignal(signal, currentPrice);
        }
        return enrichResolvedSignal(signal, currentPrice);
      })
    );
  },

  async getSignalById(id: number): Promise<EnrichedSignal> {
    const signal = await signalModel.findById(id);
    if (!signal) {
      const err = new Error(`Signal ${id} not found`) as AppError;
      err.statusCode = 404;
      throw err;
    }

    let currentPrice: number | null = null;
    try {
      currentPrice = await binanceService.getPrice(signal.symbol);
    } catch (err: unknown) {
      console.error('Binance price fetch failed:', (err as Error).message);
    }

    if (signal.status === 'OPEN') {
      return processOpenSignal(signal, currentPrice);
    }
    return enrichResolvedSignal(signal, currentPrice);
  },

  async getSignalStatus(id: number) {
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

  async deleteSignal(id: number): Promise<Signal> {
    const deleted = await signalModel.remove(id);
    if (!deleted) {
      const err = new Error(`Signal ${id} not found`) as AppError;
      err.statusCode = 404;
      throw err;
    }
    return deleted;
  },
};
