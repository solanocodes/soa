import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /weekly - top students by weekly P&L
router.get('/weekly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const leaders = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.tier,
              COALESCE(SUM(je.pnl), 0) as weekly_pnl,
              COUNT(je.id) as trade_count,
              COUNT(je.id) FILTER (WHERE je.pnl >= 0) as winning_trades
       FROM users u
       JOIN journal_entries je ON je.user_id = u.id
       WHERE je.trade_date >= CURRENT_DATE - INTERVAL '7 days'
         AND je.pnl IS NOT NULL
       GROUP BY u.id, u.username, u.display_name, u.avatar_url, u.tier
       HAVING COUNT(je.id) > 0
       ORDER BY weekly_pnl DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      leaderboard: leaders.rows.map((row: any, idx: number) => ({
        rank: idx + 1,
        ...row,
        weekly_pnl: parseFloat(row.weekly_pnl),
        win_rate: row.trade_count > 0 ? (row.winning_trades / row.trade_count * 100).toFixed(1) : '0',
      }))
    });
  } catch (error: any) {
    console.error('Get weekly leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /monthly - top students by monthly P&L
router.get('/monthly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const leaders = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.tier,
              COALESCE(SUM(je.pnl), 0) as monthly_pnl,
              COUNT(je.id) as trade_count,
              COUNT(je.id) FILTER (WHERE je.pnl >= 0) as winning_trades
       FROM users u
       JOIN journal_entries je ON je.user_id = u.id
       WHERE je.trade_date >= DATE_TRUNC('month', CURRENT_DATE)
         AND je.pnl IS NOT NULL
       GROUP BY u.id, u.username, u.display_name, u.avatar_url, u.tier
       HAVING COUNT(je.id) > 0
       ORDER BY monthly_pnl DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      leaderboard: leaders.rows.map((row: any, idx: number) => ({
        rank: idx + 1,
        ...row,
        monthly_pnl: parseFloat(row.monthly_pnl),
        win_rate: row.trade_count > 0 ? (row.winning_trades / row.trade_count * 100).toFixed(1) : '0',
      }))
    });
  } catch (error: any) {
    console.error('Get monthly leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /streaks - top win streaks
router.get('/streaks', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const leaders = await query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.tier,
              us.current_streak, us.best_streak, us.total_pnl, us.win_rate
       FROM user_stats us
       JOIN users u ON u.id = us.user_id
       WHERE us.current_streak > 0
       ORDER BY us.current_streak DESC, us.total_pnl DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      leaderboard: leaders.rows.map((row: any, idx: number) => ({
        rank: idx + 1,
        ...row,
      }))
    });
  } catch (error: any) {
    console.error('Get streaks leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
