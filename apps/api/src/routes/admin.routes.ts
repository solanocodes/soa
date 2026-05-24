import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import * as adminController from '../controllers/admin.controller';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, adminController.dashboard);
router.get('/users', authenticate, requireAdmin, adminController.listUsers);
router.patch('/users/:id/tier', authenticate, requireAdmin, adminController.updateTier);

export default router;
