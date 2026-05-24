import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /start - start live session (admin only)
router.post('/start', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    // Check if there's already an active session
    const active = await query("SELECT id FROM live_sessions WHERE status = 'active'");
    if (active.rows.length > 0) {
      res.status(400).json({ error: 'There is already an active live session' });
      return;
    }

    const roomName = `soa-live-${uuidv4().substring(0, 8)}`;

    const result = await query(
      `INSERT INTO live_sessions (host_id, title, description, room_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [req.user!.id, title, description || null, roomName]
    );

    // Notify all users with live notifications enabled
    const io = req.app.get('io');
    if (io) {
      io.emit('live_session_started', {
        session: result.rows[0],
        host: {
          username: req.user!.username,
          display_name: req.user!.display_name,
        }
      });
    }

    // Send push notification
    const { sendBulkPushNotification } = require('../services/notifications');
    await sendBulkPushNotification(
      'Live Session Started! 📡',
      `${req.user!.display_name} started: ${title}`,
      { type: 'live_session', session_id: result.rows[0].id },
      'live'
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Start live session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /end - end live session
router.post('/end', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { replay_url } = req.body;

    const active = await query("SELECT id FROM live_sessions WHERE status = 'active' AND host_id = $1", [req.user!.id]);
    if (active.rows.length === 0) {
      res.status(404).json({ error: 'No active live session found' });
      return;
    }

    const result = await query(
      `UPDATE live_sessions SET status = 'ended', ended_at = NOW(), replay_url = $1
       WHERE id = $2 RETURNING *`,
      [replay_url || null, active.rows[0].id]
    );

    const io = req.app.get('io');
    if (io) {
      io.emit('live_session_ended', { session_id: active.rows[0].id });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('End live session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /active - get current active session
router.get('/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT ls.*, u.username as host_username, u.display_name as host_display_name, u.avatar_url as host_avatar
       FROM live_sessions ls
       JOIN users u ON u.id = ls.host_id
       WHERE ls.status = 'active'
       ORDER BY ls.started_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      res.json({ session: null });
      return;
    }

    res.json({ session: result.rows[0] });
  } catch (error: any) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /replays - list past replays
router.get('/replays', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    const replays = await query(
      `SELECT ls.id, ls.title, ls.description, ls.replay_url, ls.viewer_count, ls.started_at, ls.ended_at,
              u.username as host_username, u.display_name as host_display_name, u.avatar_url as host_avatar
       FROM live_sessions ls
       JOIN users u ON u.id = ls.host_id
       WHERE ls.status = 'ended' AND ls.replay_url IS NOT NULL
       ORDER BY ls.started_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ replays: replays.rows });
  } catch (error: any) {
    console.error('Get replays error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
