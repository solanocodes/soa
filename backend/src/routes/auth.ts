import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { generateReferralCode } from '../utils/helpers';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, username, display_name, password, referral_code } = req.body;

    if (!email || !username || !password || !display_name) {
      res.status(400).json({ error: 'Email, username, display_name, and password are required' });
      return;
    }

    // Check if email or username already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email.toLowerCase(), username.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Email or username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userReferralCode = generateReferralCode();

    const result = await query(
      `INSERT INTO users (email, username, display_name, password_hash, referral_code, tier)
       VALUES ($1, $2, $3, $4, $5, 'FREE')
       RETURNING id, email, username, display_name, tier, is_admin, is_coach, avatar_url, referral_code`,
      [email.toLowerCase(), username.toLowerCase(), display_name, passwordHash, userReferralCode]
    );

    const user = result.rows[0];

    // Handle referral code if provided
    if (referral_code) {
      const referrer = await query(
        'SELECT id FROM users WHERE referral_code = $1',
        [referral_code.toUpperCase()]
      );
      if (referrer.rows.length > 0) {
        await query(
          `INSERT INTO referrals (referrer_id, referred_id, referral_code, status)
           VALUES ($1, $2, $3, 'pending')`,
          [referrer.rows[0].id, user.id, referral_code.toUpperCase()]
        );
        await query('UPDATE users SET referred_by = $1 WHERE id = $2', [referrer.rows[0].id, user.id]);
      }
    }

    // Create user_stats row
    await query('INSERT INTO user_stats (user_id) VALUES ($1)', [user.id]);

    // Generate tokens
    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      { expiresIn: '30d' }
    );

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        tier: user.tier,
        is_admin: user.is_admin,
        is_coach: user.is_coach,
        avatar_url: user.avatar_url,
        referral_code: user.referral_code,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const result = await query(
      'SELECT id, email, username, display_name, password_hash, tier, is_admin, is_coach, avatar_url, referral_code FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      { expiresIn: '30d' }
    );

    await query('UPDATE users SET refresh_token = $1, last_active_at = NOW() WHERE id = $2', [refreshToken, user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        tier: user.tier,
        is_admin: user.is_admin,
        is_coach: user.is_coach,
        avatar_url: user.avatar_url,
        referral_code: user.referral_code,
      },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const decoded = jwt.verify(
      refresh_token,
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret'
    ) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const result = await query(
      'SELECT id, email, username, display_name, tier, is_admin, is_coach, avatar_url, refresh_token FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0 || result.rows[0].refresh_token !== refresh_token) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const user = result.rows[0];

    const newAccessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
      { expiresIn: '30d' }
    );

    await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }
    console.error('Refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
      return;
    }

    const user = result.rows[0];
    const resetToken = jwt.sign(
      { userId: user.id, type: 'reset' },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '1h' }
    );

    await query(
      'UPDATE users SET reset_token = $1, reset_token_expires = NOW() + INTERVAL \'1 hour\' WHERE id = $2',
      [resetToken, user.id]
    );

    // Send email via Resend
    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'SOA <noreply@simplyoptionsacademy.com>',
        to: user.email,
        subject: 'Reset Your Password - Simply Options Academy',
        html: `
          <h2>Reset Your Password</h2>
          <p>You requested a password reset. Use this token to reset your password:</p>
          <p><strong>${resetToken}</strong></p>
          <p>This token expires in 1 hour.</p>
          <p>If you didn't request this, ignore this email.</p>
        `,
      });
    }

    res.json({ message: 'If an account exists with that email, a reset link has been sent.' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      res.status(400).json({ error: 'Token and new password are required' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as { userId: string; type: string };

    if (decoded.type !== 'reset') {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }

    const result = await query(
      'SELECT id FROM users WHERE id = $1 AND reset_token = $2 AND reset_token_expires > NOW()',
      [decoded.userId, token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, decoded.userId]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(400).json({ error: 'Reset token expired' });
      return;
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
