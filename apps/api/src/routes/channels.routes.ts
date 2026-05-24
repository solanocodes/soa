import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as channelsController from '../controllers/channels.controller';

const router = Router();

router.get('/', authenticate, channelsController.listChannels);
router.get('/:id/messages', authenticate, channelsController.getMessages);

export default router;
