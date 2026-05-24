import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /connect - connect prop firm account
router.post('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { firm_name, account_id, account_size, max_drawdown_percent } = req.body;

    if (!firm_name) {
      res.status(400).json({ error: 'firm_name is required' });
      return;
    }

    const result = await query(
      `INSERT INTO prop_firm_accounts (user_id, firm_name, account_id, account_size, current_balance, max_drawdown_percent, current_drawdown_percent)
       VALUES ($1, $2, $3, $4, $4, $5, 0)
       RETURNING *`,
      [req.user!.id, firm_name, account_id || null, account_size || null, max_drawdown_percent || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Connect prop firm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /accounts - list connected accounts
router.get('/accounts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accounts = await query(
      `SELECT id, firm_name, account_id, account_size, current_balance, max_drawdown_percent,
              current_drawdown_percent, status, connected_at, updated_at
       FROM prop_firm_accounts
       WHERE user_id = $1
       ORDER BY connected_at DESC`,
      [req.user!.id]
    );

    res.json({ accounts: accounts.rows });
  } catch (error: any) {
    console.error('Get prop firm accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /accounts/:id - get account details with drawdown info
router.get('/accounts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, firm_name, account_id, account_size, current_balance, max_drawdown_percent,
              current_drawdown_percent, status, connected_at, updated_at
       FROM prop_firm_accounts
       WHERE id = $1 AND user_id = $2`,
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const account = result.rows[0];

    // Calculate drawdown details
    const drawdownRemaining = account.max_drawdown_percent
      ? (account.max_drawdown_percent - account.current_drawdown_percent)
      : null;

    const drawdownDollar = account.account_size && account.current_drawdown_percent
      ? (account.account_size * account.current_drawdown_percent / 100)
      : null;

    const pnl = account.current_balance && account.account_size
      ? (account.current_balance - account.account_size)
      : null;

    res.json({
      ...account,
      drawdown_remaining_percent: drawdownRemaining,
      drawdown_dollar: drawdownDollar,
      pnl,
      pnl_percent: pnl && account.account_size ? (pnl / account.account_size) * 100 : null,
    });
  } catch (error: any) {
    console.error('Get prop firm account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /accounts/:id - disconnect account
router.delete('/accounts/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await query(
      'SELECT id FROM prop_firm_accounts WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    await query('DELETE FROM prop_firm_accounts WHERE id = $1', [id]);
    res.json({ message: 'Account disconnected' });
  } catch (error: any) {
    console.error('Disconnect prop firm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
