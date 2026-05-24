import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireCoach } from '../middleware/auth';
import { paginationParams } from '../utils/helpers';

const router = Router();

// GET / - get all wins, paginated, filterable
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);
    const { ticker, user_id, verified_only } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (ticker) {
      whereClause += ` AND UPPER(sw.ticker) = UPPER($${paramIdx})`;
      params.push(ticker);
      paramIdx++;
    }

    if (user_id) {
      whereClause += ` AND sw.user_id = $${paramIdx}`;
      params.push(user_id);
      paramIdx++;
    }

    if (verified_only === 'true') {
      whereClause += ' AND sw.is_verified = TRUE';
    }

    const wins = await query(
      `SELECT sw.id, sw.ticker, sw.pnl, sw.pnl_percent, sw.screenshot_url, sw.description,
              sw.is_verified, sw.is_featured, sw.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.tier as user_tier
       FROM student_wins sw
       JOIN users u ON u.id = sw.user_id
       ${whereClause}
       ORDER BY sw.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM student_wins sw ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      wins: wins.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get wins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /featured - get featured/verified wins
router.get('/featured', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { limit } = paginationParams(req.query as any);

    const wins = await query(
      `SELECT sw.id, sw.ticker, sw.pnl, sw.pnl_percent, sw.screenshot_url, sw.description,
              sw.is_verified, sw.is_featured, sw.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url
       FROM student_wins sw
       JOIN users u ON u.id = sw.user_id
       WHERE sw.is_featured = TRUE OR sw.is_verified = TRUE
       ORDER BY sw.is_featured DESC, sw.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ wins: wins.rows });
  } catch (error: any) {
    console.error('Get featured wins error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /wall - wins wall data (grid view)
router.get('/wall', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { limit } = paginationParams(req.query as any);

    const wins = await query(
      `SELECT sw.id, sw.ticker, sw.pnl, sw.pnl_percent, sw.screenshot_url,
              sw.is_verified, sw.is_featured, sw.created_at,
              u.username, u.display_name, u.avatar_url
       FROM student_wins sw
       JOIN users u ON u.id = sw.user_id
       WHERE sw.screenshot_url IS NOT NULL
       ORDER BY sw.created_at DESC
       LIMIT $1`,
      [limit]
    );

    const totalPnl = await query(
      'SELECT SUM(pnl) as total, COUNT(*) as count FROM student_wins WHERE is_verified = TRUE'
    );

    res.json({
      wins: wins.rows,
      stats: {
        total_verified_pnl: parseFloat(totalPnl.rows[0].total || '0'),
        total_verified_count: parseInt(totalPnl.rows[0].count),
      }
    });
  } catch (error: any) {
    console.error('Get wins wall error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - post a new win
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { ticker, pnl, pnl_percent, screenshot_url, description } = req.body;

    const result = await query(
      `INSERT INTO student_wins (user_id, ticker, pnl, pnl_percent, screenshot_url, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.id, ticker ? ticker.toUpperCase() : null, pnl || null, pnl_percent || null, screenshot_url || null, description || null]
    );

    // Post to share-your-wins channel
    const winsChannel = await query("SELECT id FROM channels WHERE slug = 'share-your-wins'");
    if (winsChannel.rows.length > 0) {
      const content = `🏆 **${req.user!.display_name}** posted a win!\n${ticker ? `**${ticker.toUpperCase()}**` : ''} ${pnl ? `| P&L: $${pnl}` : ''}\n${description || ''}`;
      await query(
        'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
        [winsChannel.rows[0].id, req.user!.id, content]
      );

      const io = req.app.get('io');
      if (io) {
        io.to(`channel:${winsChannel.rows[0].id}`).emit('new_message', {
          channel_id: winsChannel.rows[0].id,
          user_id: req.user!.id,
          username: req.user!.username,
          display_name: req.user!.display_name,
          content,
        });
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Post win error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/verify - verify a win (admin/coach only)
router.post('/:id/verify', authenticate, requireCoach, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_featured } = req.body;

    const existing = await query('SELECT id, user_id FROM student_wins WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Win not found' });
      return;
    }

    const result = await query(
      `UPDATE student_wins SET
         is_verified = TRUE,
         verified_by = $1,
         verified_at = NOW(),
         is_featured = COALESCE($2, is_featured)
       WHERE id = $3 RETURNING *`,
      [req.user!.id, is_featured || false, id]
    );

    // Notify the user
    const { sendPushNotification } = require('../services/notifications');
    await sendPushNotification(
      existing.rows[0].user_id,
      'Win Verified! 🏆',
      'Your win has been verified by a coach!',
      { type: 'win_verified', win_id: id }
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Verify win error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
