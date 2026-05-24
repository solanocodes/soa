import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { tierMeetsRequirement } from '../utils/helpers';

const router = Router();

// GET / - list courses (filtered by tier)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.id, c.title, c.description, c.thumbnail_url, c.required_tier, c.position,
              (SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id AND cm.is_published = TRUE) as module_count,
              (SELECT COUNT(*) FROM course_progress cp
               JOIN course_modules cm2 ON cm2.id = cp.module_id
               WHERE cm2.course_id = c.id AND cp.user_id = $1 AND cp.is_completed = TRUE) as completed_count
       FROM courses c
       WHERE c.is_published = TRUE
       ORDER BY c.position ASC`,
      [req.user!.id]
    );

    const isPrivileged = req.user!.is_admin || req.user!.is_coach;
    const courses = result.rows.filter(c =>
      isPrivileged || tierMeetsRequirement(req.user!.tier, c.required_tier)
    );

    res.json({ courses });
  } catch (error: any) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id/modules - list modules for course
router.get('/:id/modules', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify course exists and user has access
    const courseResult = await query(
      'SELECT id, title, required_tier FROM courses WHERE id = $1 AND is_published = TRUE',
      [id]
    );
    if (courseResult.rows.length === 0) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    const course = courseResult.rows[0];
    const isPrivileged = req.user!.is_admin || req.user!.is_coach;
    if (!isPrivileged && !tierMeetsRequirement(req.user!.tier, course.required_tier)) {
      res.status(403).json({ error: 'Insufficient tier to access this course' });
      return;
    }

    const modules = await query(
      `SELECT cm.id, cm.title, cm.description, cm.video_url, cm.duration_seconds, cm.position,
              cp.is_completed, cp.watch_time_seconds, cp.completed_at
       FROM course_modules cm
       LEFT JOIN course_progress cp ON cp.module_id = cm.id AND cp.user_id = $1
       WHERE cm.course_id = $2 AND cm.is_published = TRUE
       ORDER BY cm.position ASC`,
      [req.user!.id, id]
    );

    res.json({ course: courseResult.rows[0], modules: modules.rows });
  } catch (error: any) {
    console.error('Get modules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:moduleId/progress - update progress
router.post('/:moduleId/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { is_completed, watch_time_seconds } = req.body;

    // Verify module exists
    const moduleResult = await query(
      'SELECT cm.id, c.required_tier FROM course_modules cm JOIN courses c ON c.id = cm.course_id WHERE cm.id = $1',
      [moduleId]
    );
    if (moduleResult.rows.length === 0) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    const completedAt = is_completed ? 'NOW()' : 'NULL';

    const result = await query(
      `INSERT INTO course_progress (user_id, module_id, is_completed, watch_time_seconds, completed_at, updated_at)
       VALUES ($1, $2, $3, $4, ${is_completed ? 'NOW()' : 'NULL'}, NOW())
       ON CONFLICT (user_id, module_id) DO UPDATE SET
         is_completed = COALESCE($3, course_progress.is_completed),
         watch_time_seconds = COALESCE($4, course_progress.watch_time_seconds),
         completed_at = CASE WHEN $3 = TRUE AND course_progress.completed_at IS NULL THEN NOW() ELSE course_progress.completed_at END,
         updated_at = NOW()
       RETURNING *`,
      [req.user!.id, moduleId, is_completed || false, watch_time_seconds || 0]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /progress - get all user progress
router.get('/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const progress = await query(
      `SELECT cp.*, cm.title as module_title, cm.course_id, c.title as course_title
       FROM course_progress cp
       JOIN course_modules cm ON cm.id = cp.module_id
       JOIN courses c ON c.id = cm.course_id
       WHERE cp.user_id = $1
       ORDER BY c.position ASC, cm.position ASC`,
      [req.user!.id]
    );

    // Group by course
    const byCourse: Record<string, { course_id: string; course_title: string; modules: any[] }> = {};
    for (const row of progress.rows) {
      if (!byCourse[row.course_id]) {
        byCourse[row.course_id] = { course_id: row.course_id, course_title: row.course_title, modules: [] };
      }
      byCourse[row.course_id].modules.push(row);
    }

    res.json({ progress: Object.values(byCourse) });
  } catch (error: any) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
