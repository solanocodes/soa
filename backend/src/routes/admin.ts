import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { paginationParams } from '../utils/helpers';

const router = Router();

// All admin routes require authentication + admin
router.use(authenticate, requireAdmin);

// GET /dashboard - dashboard stats
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  try {
    // Total students by tier
    const tierCounts = await query(
      `SELECT tier, COUNT(*) as count FROM users WHERE is_admin = FALSE AND is_coach = FALSE GROUP BY tier`
    );

    // Total students
    const totalStudents = await query(
      'SELECT COUNT(*) as count FROM users WHERE is_admin = FALSE AND is_coach = FALSE'
    );

    // Active students (active in last 7 days)
    const activeStudents = await query(
      `SELECT COUNT(*) as count FROM users
       WHERE is_admin = FALSE AND is_coach = FALSE AND last_active_at > NOW() - INTERVAL '7 days'`
    );

    // Inactive students (not active in 14+ days)
    const inactiveStudents = await query(
      `SELECT COUNT(*) as count FROM users
       WHERE is_admin = FALSE AND is_coach = FALSE AND last_active_at < NOW() - INTERVAL '14 days'`
    );

    // Revenue this month
    const monthlyRevenue = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE status = 'succeeded' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`
    );

    // Total revenue
    const totalRevenue = await query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'succeeded'`
    );

    // Pending automations
    const pendingAutomations = await query(
      `SELECT COUNT(*) as count FROM automation_events WHERE status = 'pending'`
    );

    // Pending AI DM approvals
    const pendingAI = await query(
      `SELECT COUNT(*) as count FROM direct_messages WHERE is_ai_generated = TRUE AND ai_approved IS NULL`
    );

    // Recent signups (last 7 days)
    const recentSignups = await query(
      `SELECT COUNT(*) as count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`
    );

    // Today's alerts count
    const todayAlerts = await query(
      `SELECT COUNT(*) as count FROM alerts WHERE created_at >= CURRENT_DATE`
    );

    // Today's wins
    const todayWins = await query(
      `SELECT COUNT(*) as count FROM student_wins WHERE created_at >= CURRENT_DATE`
    );

    const tierMap: Record<string, number> = {};
    for (const row of tierCounts.rows) {
      tierMap[row.tier] = parseInt(row.count);
    }

    res.json({
      students: {
        total: parseInt(totalStudents.rows[0].count),
        active: parseInt(activeStudents.rows[0].count),
        inactive: parseInt(inactiveStudents.rows[0].count),
        by_tier: tierMap,
        recent_signups: parseInt(recentSignups.rows[0].count),
      },
      revenue: {
        monthly: parseFloat(monthlyRevenue.rows[0].total),
        total: parseFloat(totalRevenue.rows[0].total),
      },
      automation_queue: parseInt(pendingAutomations.rows[0].count),
      ai_pending_approvals: parseInt(pendingAI.rows[0].count),
      today: {
        alerts: parseInt(todayAlerts.rows[0].count),
        wins: parseInt(todayWins.rows[0].count),
      }
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /students - list all students with filters
router.get('/students', async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);
    const { tier, search, sort_by, sort_order } = req.query;

    let whereClause = 'WHERE is_admin = FALSE AND is_coach = FALSE';
    const params: any[] = [];
    let paramIdx = 1;

    if (tier) {
      whereClause += ` AND tier = $${paramIdx}`;
      params.push(tier);
      paramIdx++;
    }

    if (search) {
      whereClause += ` AND (username ILIKE $${paramIdx} OR display_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const validSorts = ['created_at', 'last_active_at', 'username', 'tier'];
    const sortCol = validSorts.includes(sort_by as string) ? sort_by : 'created_at';
    const sortDir = sort_order === 'asc' ? 'ASC' : 'DESC';

    const students = await query(
      `SELECT u.id, u.email, u.username, u.display_name, u.avatar_url, u.tier,
              u.subscription_status, u.subscription_expires_at, u.last_active_at, u.created_at,
              us.total_trades, us.total_pnl, us.win_rate
       FROM users u
       LEFT JOIN user_stats us ON us.user_id = u.id
       ${whereClause}
       ORDER BY u.${sortCol} ${sortDir}
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      students: students.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /automations - list pending automations
router.get('/automations', async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);
    const { status } = req.query;

    const filterStatus = status || 'pending';

    const automations = await query(
      `SELECT ae.*, u.username, u.display_name, u.email
       FROM automation_events ae
       LEFT JOIN users u ON u.id = ae.user_id
       WHERE ae.status = $1
       ORDER BY ae.scheduled_for ASC
       LIMIT $2 OFFSET $3`,
      [filterStatus, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM automation_events WHERE status = $1',
      [filterStatus]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      automations: automations.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get automations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /ai-queue - pending AI DM approvals
router.get('/ai-queue', async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);

    const messages = await query(
      `SELECT dm.id, dm.content, dm.created_at, dm.thread_id,
              dmt.participant_1, dmt.participant_2, dmt.ai_mode,
              u1.username as p1_username, u1.display_name as p1_display_name,
              u2.username as p2_username, u2.display_name as p2_display_name
       FROM direct_messages dm
       JOIN direct_message_threads dmt ON dmt.id = dm.thread_id
       JOIN users u1 ON u1.id = dmt.participant_1
       JOIN users u2 ON u2.id = dmt.participant_2
       WHERE dm.is_ai_generated = TRUE AND dm.ai_approved IS NULL
       ORDER BY dm.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM direct_messages WHERE is_ai_generated = TRUE AND ai_approved IS NULL'
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      messages: messages.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get AI queue error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /ai-queue/:id/approve - approve AI message
router.post('/ai-queue/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT id, thread_id, content FROM direct_messages WHERE id = $1 AND is_ai_generated = TRUE',
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'AI message not found' });
      return;
    }

    await query('UPDATE direct_messages SET ai_approved = TRUE WHERE id = $1', [id]);

    // Update thread last_message_at
    await query('UPDATE direct_message_threads SET last_message_at = NOW() WHERE id = $1', [existing.rows[0].thread_id]);

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`dm:${existing.rows[0].thread_id}`).emit('new_dm', existing.rows[0]);
    }

    res.json({ message: 'AI message approved and sent' });
  } catch (error: any) {
    console.error('Approve AI message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /ai-queue/:id/edit - edit and send AI message
router.post('/ai-queue/:id/edit', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const existing = await query(
      'SELECT id, thread_id FROM direct_messages WHERE id = $1 AND is_ai_generated = TRUE',
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'AI message not found' });
      return;
    }

    await query(
      'UPDATE direct_messages SET content = $1, ai_approved = TRUE WHERE id = $2',
      [content, id]
    );

    await query('UPDATE direct_message_threads SET last_message_at = NOW() WHERE id = $1', [existing.rows[0].thread_id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`dm:${existing.rows[0].thread_id}`).emit('new_dm', { ...existing.rows[0], content });
    }

    res.json({ message: 'AI message edited and sent' });
  } catch (error: any) {
    console.error('Edit AI message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
