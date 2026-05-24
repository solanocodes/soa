import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as messagesController from '../controllers/messages.controller';

const router = Router();

router.post('/', authenticate, messagesController.sendMessage);
router.post('/:id/reactions', authenticate, messagesController.addReaction);
router.delete('/:id/reactions/:emoji', authenticate, messagesController.removeReaction);
router.delete('/:id', authenticate, messagesController.deleteMessage);

export default router;
