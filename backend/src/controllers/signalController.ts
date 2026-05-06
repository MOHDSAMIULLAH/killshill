import { Request, Response, NextFunction } from 'express';
import { signalService } from '../services/signalService';

function parseId(raw: string | string[]): number | null {
  const id = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

export const signalController = {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signal = await signalService.createSignal(req.body as Record<string, unknown>);
      res.status(201).json({ success: true, data: signal });
    } catch (err) {
      next(err);
    }
  },

  async getAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signals = await signalService.getAllSignals();
      res.json({ success: true, data: signals });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid signal ID' });
      return;
    }
    try {
      const signal = await signalService.getSignalById(id);
      res.json({ success: true, data: signal });
    } catch (err) {
      next(err);
    }
  },

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid signal ID' });
      return;
    }
    try {
      const status = await signalService.getSignalStatus(id);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ success: false, message: 'Invalid signal ID' });
      return;
    }
    try {
      const deleted = await signalService.deleteSignal(id);
      res.json({ success: true, data: deleted, message: 'Signal deleted' });
    } catch (err) {
      next(err);
    }
  },
};
