import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dmsController from '../controllers/dms.controller';

const router = Router();

router.get('/threads', authenticate, dmsController.listThreads);
router.get('/threads/:threadId/messages', authenticate, dmsController.getMessages);
router.post('/threads/:threadId/messages', authenticate, dmsController.sendMessage);
router.post('/threads', authenticate, dmsController.createThread);

export default router;
