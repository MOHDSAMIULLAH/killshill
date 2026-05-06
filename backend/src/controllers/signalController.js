const signalService = require('../services/signalService');

function parseId(raw) {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

const signalController = {
  async create(req, res, next) {
    try {
      const signal = await signalService.createSignal(req.body);
      res.status(201).json({ success: true, data: signal });
    } catch (err) {
      next(err);
    }
  },

  async getAll(req, res, next) {
    try {
      const signals = await signalService.getAllSignals();
      res.json({ success: true, data: signals });
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid signal ID' });
    try {
      const signal = await signalService.getSignalById(id);
      res.json({ success: true, data: signal });
    } catch (err) {
      next(err);
    }
  },

  async getStatus(req, res, next) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid signal ID' });
    try {
      const status = await signalService.getSignalStatus(id);
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid signal ID' });
    try {
      const deleted = await signalService.deleteSignal(id);
      res.json({ success: true, data: deleted, message: 'Signal deleted' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = signalController;
