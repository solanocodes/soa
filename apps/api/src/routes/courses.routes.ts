import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as coursesController from '../controllers/courses.controller';

const router = Router();

router.get('/', authenticate, coursesController.listCourses);
router.get('/:id/modules', authenticate, coursesController.getModules);
router.post('/progress', authenticate, coursesController.markProgress);

export default router;
