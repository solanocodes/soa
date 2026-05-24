import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /me - get current user profile
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, username, display_name, avatar_url, tier, is_admin, is_coach,
              referral_code, stripe_customer_id, subscription_status, subscription_expires_at,
              notification_preferences, last_active_at, created_at
       FROM users WHERE id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me - update profile
router.put('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { display_name, avatar_url, username } = req.body;

    // Check username uniqueness if changing
    if (username && username !== req.user!.username) {
      const existing = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username.toLowerCase(), req.user!.id]);
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
    }

    const result = await query(
      `UPDATE users SET
         display_name = COALESCE($1, display_name),
         avatar_url = COALESCE($2, avatar_url),
         username = COALESCE($3, username),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, username, display_name, avatar_url, tier, is_admin, is_coach, referral_code, notification_preferences`,
      [display_name, avatar_url, username ? username.toLowerCase() : null, req.user!.id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me/stats - get user stats
router.get('/me/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await query('SELECT * FROM user_stats WHERE user_id = $1', [req.user!.id]);

    const winsCount = await query(
      'SELECT COUNT(*) as total FROM student_wins WHERE user_id = $1',
      [req.user!.id]
    );

    const journalCount = await query(
      'SELECT COUNT(*) as total FROM journal_entries WHERE user_id = $1',
      [req.user!.id]
    );

    const courseProgress = await query(
      `SELECT
         COUNT(DISTINCT cp.module_id) FILTER (WHERE cp.is_completed) as completed_modules,
         COUNT(DISTINCT cm.id) as total_modules
       FROM course_modules cm
       JOIN courses co ON co.id = cm.course_id
       LEFT JOIN course_progress cp ON cp.module_id = cm.id AND cp.user_id = $1
       WHERE co.is_published = TRUE`,
      [req.user!.id]
    );

    res.json({
      trading: stats.rows[0] || {
        total_trades: 0, winning_trades: 0, losing_trades: 0,
        total_pnl: 0, win_rate: 0, current_streak: 0, best_streak: 0,
        weekly_pnl: 0, monthly_pnl: 0,
      },
      wins_count: parseInt(winsCount.rows[0].total),
      journal_entries_count: parseInt(journalCount.rows[0].total),
      course_progress: {
        completed: parseInt(courseProgress.rows[0].completed_modules),
        total: parseInt(courseProgress.rows[0].total_modules),
      },
    });
  } catch (error: any) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /me/notifications - update notification preferences
router.put('/me/notifications', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { alerts, dms, wins, live, marketing, push_token } = req.body;

    const prefs: Record<string, boolean> = {};
    if (alerts !== undefined) prefs.alerts = alerts;
    if (dms !== undefined) prefs.dms = dms;
    if (wins !== undefined) prefs.wins = wins;
    if (live !== undefined) prefs.live = live;
    if (marketing !== undefined) prefs.marketing = marketing;

    let updateQuery = 'UPDATE users SET updated_at = NOW()';
    const params: any[] = [];
    let paramIdx = 1;

    if (Object.keys(prefs).length > 0) {
      updateQuery += `, notification_preferences = notification_preferences || $${paramIdx}::jsonb`;
      params.push(JSON.stringify(prefs));
      paramIdx++;
    }

    if (push_token !== undefined) {
      updateQuery += `, push_token = $${paramIdx}`;
      params.push(push_token);
      paramIdx++;
    }

    updateQuery += ` WHERE id = $${paramIdx} RETURNING notification_preferences, push_token`;
    params.push(req.user!.id);

    const result = await query(updateQuery, params);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
