import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET / - get user's referral stats and history
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const referrals = await query(
      `SELECT r.id, r.referral_code, r.status, r.reward_amount, r.rewarded_at, r.created_at,
              u.username, u.display_name, u.tier, u.created_at as user_joined
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       WHERE r.referrer_id = $1
       ORDER BY r.created_at DESC`,
      [req.user!.id]
    );

    const stats = await query(
      `SELECT
         COUNT(*) as total_referrals,
         COUNT(*) FILTER (WHERE status = 'converted') as converted,
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COALESCE(SUM(reward_amount) FILTER (WHERE rewarded_at IS NOT NULL), 0) as total_earned
       FROM referrals
       WHERE referrer_id = $1`,
      [req.user!.id]
    );

    res.json({
      referrals: referrals.rows,
      stats: stats.rows[0],
    });
  } catch (error: any) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /code - get user's referral code
router.get('/code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT referral_code FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (!result.rows[0].referral_code) {
      // Generate one if missing
      const { generateReferralCode } = require('../utils/helpers');
      const code = generateReferralCode();
      await query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, req.user!.id]);
      res.json({ referral_code: code });
      return;
    }

    res.json({ referral_code: result.rows[0].referral_code });
  } catch (error: any) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /apply - apply referral code during signup
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { referral_code } = req.body;

    if (!referral_code) {
      res.status(400).json({ error: 'referral_code is required' });
      return;
    }

    // Check if user already has a referrer
    const user = await query('SELECT referred_by FROM users WHERE id = $1', [req.user!.id]);
    if (user.rows[0].referred_by) {
      res.status(400).json({ error: 'You have already used a referral code' });
      return;
    }

    // Find referrer
    const referrer = await query(
      'SELECT id FROM users WHERE referral_code = $1',
      [referral_code.toUpperCase()]
    );
    if (referrer.rows.length === 0) {
      res.status(404).json({ error: 'Invalid referral code' });
      return;
    }

    if (referrer.rows[0].id === req.user!.id) {
      res.status(400).json({ error: 'You cannot refer yourself' });
      return;
    }

    // Create referral record
    await query(
      `INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (referred_id) DO NOTHING`,
      [referrer.rows[0].id, req.user!.id, referral_code.toUpperCase()]
    );

    await query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrer.rows[0].id, req.user!.id]);

    res.json({ message: 'Referral code applied successfully' });
  } catch (error: any) {
    console.error('Apply referral error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
