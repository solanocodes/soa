import { Router } from 'express';
import { authenticate, requireCoach } from '../middleware/auth';
import * as alertsController from '../controllers/alerts.controller';

const router = Router();

router.get('/', authenticate, alertsController.listAlerts);
router.post('/', authenticate, requireCoach, alertsController.createAlert);

export default router;
