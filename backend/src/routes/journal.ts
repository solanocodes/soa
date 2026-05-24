import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireCoach } from '../middleware/auth';
import { paginationParams } from '../utils/helpers';

const router = Router();

// GET / - get user's journal entries, paginated
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);

    const entries = await query(
      `SELECT je.*, u.username as coach_username, u.display_name as coach_display_name
       FROM journal_entries je
       LEFT JOIN users u ON u.id = je.coach_reviewed_by
       WHERE je.user_id = $1
       ORDER BY je.trade_date DESC, je.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM journal_entries WHERE user_id = $1',
      [req.user!.id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      entries: entries.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get journal entries error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create journal entry
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { ticker, direction, entry_price, exit_price, quantity, pnl, pnl_percent, setup_type, notes, screenshot_url, trade_date } = req.body;

    if (!ticker) {
      res.status(400).json({ error: 'Ticker is required' });
      return;
    }

    const result = await query(
      `INSERT INTO journal_entries (user_id, ticker, direction, entry_price, exit_price, quantity, pnl, pnl_percent, setup_type, notes, screenshot_url, trade_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.user!.id, ticker.toUpperCase(), direction || null, entry_price || null, exit_price || null, quantity || null, pnl || null, pnl_percent || null, setup_type || null, notes || null, screenshot_url || null, trade_date || new Date().toISOString().split('T')[0]]
    );

    // Update user stats
    if (pnl !== undefined && pnl !== null) {
      const pnlNum = parseFloat(pnl);
      const isWin = pnlNum >= 0;

      await query(
        `INSERT INTO user_stats (user_id, total_trades, winning_trades, losing_trades, total_pnl, best_trade_pnl, worst_trade_pnl, current_streak, best_streak, updated_at)
         VALUES ($1, 1, $2, $3, $4, GREATEST(0, $4), LEAST(0, $4), $5, GREATEST(1, $5), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           total_trades = user_stats.total_trades + 1,
           winning_trades = user_stats.winning_trades + $2,
           losing_trades = user_stats.losing_trades + $3,
           total_pnl = user_stats.total_pnl + $4,
           best_trade_pnl = GREATEST(user_stats.best_trade_pnl, $4),
           worst_trade_pnl = LEAST(user_stats.worst_trade_pnl, $4),
           current_streak = CASE WHEN $6 THEN user_stats.current_streak + 1 ELSE 0 END,
           best_streak = GREATEST(user_stats.best_streak, CASE WHEN $6 THEN user_stats.current_streak + 1 ELSE user_stats.best_streak END),
           avg_win = CASE WHEN user_stats.winning_trades + $2 > 0
                     THEN (user_stats.avg_win * user_stats.winning_trades + CASE WHEN $6 THEN $4 ELSE 0 END) / (user_stats.winning_trades + $2)
                     ELSE user_stats.avg_win END,
           avg_loss = CASE WHEN user_stats.losing_trades + $3 > 0
                      THEN (user_stats.avg_loss * user_stats.losing_trades + CASE WHEN NOT $6 THEN $4 ELSE 0 END) / (user_stats.losing_trades + $3)
                      ELSE user_stats.avg_loss END,
           win_rate = CASE WHEN user_stats.total_trades + 1 > 0
                      THEN ((user_stats.winning_trades + $2)::DECIMAL / (user_stats.total_trades + 1)) * 100
                      ELSE 0 END,
           weekly_pnl = user_stats.weekly_pnl + $4,
           monthly_pnl = user_stats.monthly_pnl + $4,
           updated_at = NOW()`,
        [req.user!.id, isWin ? 1 : 0, isWin ? 0 : 1, pnlNum, isWin ? 1 : 0, isWin]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Create journal entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update journal entry
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { ticker, direction, entry_price, exit_price, quantity, pnl, pnl_percent, setup_type, notes, screenshot_url, trade_date } = req.body;

    const existing = await query('SELECT user_id FROM journal_entries WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }
    if (existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'You can only edit your own journal entries' });
      return;
    }

    const result = await query(
      `UPDATE journal_entries SET
         ticker = COALESCE($1, ticker),
         direction = COALESCE($2, direction),
         entry_price = COALESCE($3, entry_price),
         exit_price = COALESCE($4, exit_price),
         quantity = COALESCE($5, quantity),
         pnl = COALESCE($6, pnl),
         pnl_percent = COALESCE($7, pnl_percent),
         setup_type = COALESCE($8, setup_type),
         notes = COALESCE($9, notes),
         screenshot_url = COALESCE($10, screenshot_url),
         trade_date = COALESCE($11, trade_date),
         updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
      [ticker, direction, entry_price, exit_price, quantity, pnl, pnl_percent, setup_type, notes, screenshot_url, trade_date, id]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update journal entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stats - get user's trading stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [req.user!.id]
    );

    if (stats.rows.length === 0) {
      res.json({
        total_trades: 0, winning_trades: 0, losing_trades: 0,
        total_pnl: 0, best_trade_pnl: 0, worst_trade_pnl: 0,
        current_streak: 0, best_streak: 0, avg_win: 0, avg_loss: 0,
        win_rate: 0, weekly_pnl: 0, monthly_pnl: 0,
      });
      return;
    }

    // Also get recent daily PnL for charts
    const dailyPnl = await query(
      `SELECT trade_date, SUM(pnl) as daily_pnl, COUNT(*) as trade_count
       FROM journal_entries
       WHERE user_id = $1 AND pnl IS NOT NULL AND trade_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY trade_date
       ORDER BY trade_date ASC`,
      [req.user!.id]
    );

    res.json({
      ...stats.rows[0],
      daily_pnl: dailyPnl.rows,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/share - share journal entry to wins channel
router.post('/:id/share', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const entry = await query('SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2', [id, req.user!.id]);
    if (entry.rows.length === 0) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    const je = entry.rows[0];

    // Create a win from the journal entry
    const win = await query(
      `INSERT INTO student_wins (user_id, journal_entry_id, ticker, pnl, pnl_percent, screenshot_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.id, je.id, je.ticker, je.pnl, je.pnl_percent, je.screenshot_url, je.notes]
    );

    // Mark journal entry as shared
    await query('UPDATE journal_entries SET is_shared = TRUE WHERE id = $1', [id]);

    // Post to share-your-wins channel
    const winsChannel = await query("SELECT id FROM channels WHERE slug = 'share-your-wins'");
    if (winsChannel.rows.length > 0) {
      const content = `🏆 **${req.user!.display_name}** shared a win!\n**${je.ticker}** ${je.direction || ''} | P&L: $${je.pnl || 0}\n${je.notes || ''}`;
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

    res.status(201).json(win.rows[0]);
  } catch (error: any) {
    console.error('Share journal entry error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/review - coach adds review
router.post('/:id/review', authenticate, requireCoach, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { coach_review } = req.body;

    if (!coach_review) {
      res.status(400).json({ error: 'Coach review is required' });
      return;
    }

    const existing = await query('SELECT id, user_id FROM journal_entries WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }

    const result = await query(
      `UPDATE journal_entries SET coach_review = $1, coach_reviewed_by = $2, coach_reviewed_at = NOW()
       WHERE id = $3 RETURNING *`,
      [coach_review, req.user!.id, id]
    );

    // Notify the student
    const { sendPushNotification } = require('../services/notifications');
    await sendPushNotification(
      existing.rows[0].user_id,
      'Coach Review',
      `${req.user!.display_name} reviewed your trade journal entry`,
      { type: 'journal_review', entry_id: id }
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Coach review error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
