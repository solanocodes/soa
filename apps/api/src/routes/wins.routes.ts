import { Router } from 'express';
import { authenticate, requireCoach } from '../middleware/auth';
import { requireTier } from '../middleware/tierGate';
import * as winsController from '../controllers/wins.controller';

const router = Router();

router.get('/', authenticate, winsController.listWins);
router.post('/', authenticate, requireTier('SOA_CORE'), winsController.postWin);
router.patch('/:id/verify', authenticate, requireCoach, winsController.verifyWin);

export default router;
