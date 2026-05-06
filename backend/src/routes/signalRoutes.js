const { Router } = require('express');
const signalController = require('../controllers/signalController');

const router = Router();

router.post('/', signalController.create);
router.get('/', signalController.getAll);
router.get('/:id/status', signalController.getStatus);
router.get('/:id', signalController.getById);
router.delete('/:id', signalController.remove);

module.exports = router;
