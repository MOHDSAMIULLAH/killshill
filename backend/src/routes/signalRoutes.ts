import { Router } from 'express';
import { signalController } from '../controllers/signalController';

const router = Router();

router.post('/', signalController.create);
router.get('/', signalController.getAll);
router.get('/:id/status', signalController.getStatus);
router.get('/:id', signalController.getById);
router.delete('/:id', signalController.remove);

export default router;
