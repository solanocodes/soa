import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireCoach } from '../middleware/auth';
import { paginationParams, tierMeetsRequirement } from '../utils/helpers';

const router = Router();

// GET / - get all alerts user can access, paginated, filterable by channel_slug
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);
    const { channel_slug } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (channel_slug) {
      whereClause += ` AND c.slug = $${paramIdx}`;
      params.push(channel_slug);
      paramIdx++;
    }

    // Filter by tier access
    if (!req.user!.is_admin && !req.user!.is_coach) {
      const tierFilter = `AND (
        c.required_tier = 'FREE'
        ${req.user!.tier === 'SOA_CORE' || req.user!.tier === 'SOA_WEALTH' || req.user!.tier === 'BOT_PRODUCT' ? "OR c.required_tier = 'SOA_CORE'" : ''}
        ${req.user!.tier === 'SOA_WEALTH' || req.user!.tier === 'BOT_PRODUCT' ? "OR c.required_tier = 'SOA_WEALTH'" : ''}
        ${req.user!.tier === 'BOT_PRODUCT' ? "OR c.required_tier = 'BOT_PRODUCT'" : ''}
      )`;
      whereClause += ` ${tierFilter}`;
    }

    const alerts = await query(
      `SELECT a.id, a.ticker, a.direction, a.entry_price, a.stop_loss, a.take_profit,
              a.setup_type, a.notes, a.screenshot_url, a.status, a.result_pnl, a.closed_at, a.created_at,
              c.slug as channel_slug, c.name as channel_name,
              u.username, u.display_name, u.avatar_url
       FROM alerts a
       JOIN channels c ON c.id = a.channel_id
       JOIN users u ON u.id = a.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM alerts a JOIN channels c ON c.id = a.channel_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      alerts: alerts.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /historical - get historical alerts with search
router.get('/historical', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset, limit, page } = paginationParams(req.query as any);
    const { ticker, setup_type, direction, start_date, end_date } = req.query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 1;

    if (ticker) {
      whereClause += ` AND UPPER(a.ticker) = UPPER($${paramIdx})`;
      params.push(ticker);
      paramIdx++;
    }

    if (setup_type) {
      whereClause += ` AND a.setup_type = $${paramIdx}`;
      params.push(setup_type);
      paramIdx++;
    }

    if (direction) {
      whereClause += ` AND a.direction = $${paramIdx}`;
      params.push((direction as string).toUpperCase());
      paramIdx++;
    }

    if (start_date) {
      whereClause += ` AND a.created_at >= $${paramIdx}`;
      params.push(start_date);
      paramIdx++;
    }

    if (end_date) {
      whereClause += ` AND a.created_at <= $${paramIdx}`;
      params.push(end_date);
      paramIdx++;
    }

    // Filter by tier access
    if (!req.user!.is_admin && !req.user!.is_coach) {
      const accessibleTiers = ['FREE'];
      if (tierMeetsRequirement(req.user!.tier, 'SOA_CORE')) accessibleTiers.push('SOA_CORE');
      if (tierMeetsRequirement(req.user!.tier, 'SOA_WEALTH')) accessibleTiers.push('SOA_WEALTH');
      if (tierMeetsRequirement(req.user!.tier, 'BOT_PRODUCT')) accessibleTiers.push('BOT_PRODUCT');
      whereClause += ` AND c.required_tier = ANY($${paramIdx})`;
      params.push(accessibleTiers);
      paramIdx++;
    }

    const alerts = await query(
      `SELECT a.id, a.ticker, a.direction, a.entry_price, a.stop_loss, a.take_profit,
              a.setup_type, a.notes, a.screenshot_url, a.status, a.result_pnl, a.closed_at, a.created_at,
              c.slug as channel_slug, c.name as channel_name,
              u.username, u.display_name
       FROM alerts a
       JOIN channels c ON c.id = a.channel_id
       JOIN users u ON u.id = a.user_id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as total FROM alerts a JOIN channels c ON c.id = a.channel_id ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      alerts: alerts.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get historical alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - post new alert (admin/coach only)
router.post('/', authenticate, requireCoach, async (req: AuthRequest, res: Response) => {
  try {
    const { channel_id, ticker, direction, entry_price, stop_loss, take_profit, setup_type, notes, screenshot_url } = req.body;

    if (!channel_id || !ticker) {
      res.status(400).json({ error: 'channel_id and ticker are required' });
      return;
    }

    // Verify channel is an alerts channel
    const channelResult = await query(
      'SELECT id, channel_type, slug FROM channels WHERE id = $1',
      [channel_id]
    );
    if (channelResult.rows.length === 0) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }
    if (channelResult.rows[0].channel_type !== 'alerts') {
      res.status(400).json({ error: 'Channel is not an alerts channel' });
      return;
    }

    const result = await query(
      `INSERT INTO alerts (channel_id, user_id, ticker, direction, entry_price, stop_loss, take_profit, setup_type, notes, screenshot_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [channel_id, req.user!.id, ticker.toUpperCase(), direction || null, entry_price || null, stop_loss || null, take_profit || null, setup_type || null, notes || null, screenshot_url || null]
    );

    const alert = result.rows[0];

    // Also create a message in the channel for the alert
    await query(
      `INSERT INTO messages (channel_id, user_id, content)
       VALUES ($1, $2, $3)`,
      [channel_id, req.user!.id, `🚨 **${ticker.toUpperCase()}** ${direction || ''} @ ${entry_price || 'Market'}\n${notes || ''}`]
    );

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel_id}`).emit('new_alert', {
        ...alert,
        username: req.user!.username,
        display_name: req.user!.display_name,
        channel_slug: channelResult.rows[0].slug,
      });
    }

    res.status(201).json(alert);
  } catch (error: any) {
    console.error('Post alert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
