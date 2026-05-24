import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { tierMeetsRequirement } from '../utils/helpers';
import { paginationParams } from '../utils/helpers';

const router = Router();

// GET / - list all channels user can access (filtered by tier)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, name, slug, description, category, channel_type, required_tier, position FROM channels WHERE is_archived = FALSE ORDER BY position ASC'
    );

    const userTier = req.user!.tier;
    const isPrivileged = req.user!.is_admin || req.user!.is_coach;

    const channels = result.rows.filter(ch =>
      isPrivileged || tierMeetsRequirement(userTier, ch.required_tier)
    );

    // Group by category
    const grouped: Record<string, any[]> = {};
    for (const ch of channels) {
      if (!grouped[ch.category]) grouped[ch.category] = [];
      grouped[ch.category].push(ch);
    }

    res.json({ channels, grouped });
  } catch (error: any) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug - get channel details
router.get('/:slug', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await query(
      'SELECT id, name, slug, description, category, channel_type, required_tier, position FROM channels WHERE slug = $1 AND is_archived = FALSE',
      [slug]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const channel = result.rows[0];
    const isPrivileged = req.user!.is_admin || req.user!.is_coach;

    if (!isPrivileged && !tierMeetsRequirement(req.user!.tier, channel.required_tier)) {
      res.status(403).json({ error: 'Insufficient tier to access this channel' });
      return;
    }

    // Get member count (users with sufficient tier)
    const memberCount = await query(
      `SELECT COUNT(*) as count FROM users WHERE
       CASE
         WHEN $1 = 'FREE' THEN TRUE
         WHEN $1 = 'SOA_CORE' THEN tier IN ('SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT')
         WHEN $1 = 'SOA_WEALTH' THEN tier IN ('SOA_WEALTH', 'BOT_PRODUCT')
         WHEN $1 = 'BOT_PRODUCT' THEN tier = 'BOT_PRODUCT'
         ELSE FALSE
       END OR is_admin = TRUE OR is_coach = TRUE`,
      [channel.required_tier]
    );

    res.json({ ...channel, member_count: parseInt(memberCount.rows[0].count) });
  } catch (error: any) {
    console.error('Get channel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:slug/messages - paginated messages for channel
router.get('/:slug/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const { offset, limit, page } = paginationParams(req.query as any);

    // Verify channel access
    const channelResult = await query(
      'SELECT id, required_tier FROM channels WHERE slug = $1 AND is_archived = FALSE',
      [slug]
    );

    if (channelResult.rows.length === 0) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const channel = channelResult.rows[0];
    const isPrivileged = req.user!.is_admin || req.user!.is_coach;

    if (!isPrivileged && !tierMeetsRequirement(req.user!.tier, channel.required_tier)) {
      res.status(403).json({ error: 'Insufficient tier to access this channel' });
      return;
    }

    const messages = await query(
      `SELECT m.id, m.content, m.reply_to_id, m.is_pinned, m.is_deleted, m.edited_at, m.created_at,
              u.id as user_id, u.username, u.display_name, u.avatar_url, u.tier as user_tier, u.is_admin as user_is_admin, u.is_coach as user_is_coach,
              (SELECT json_agg(json_build_object('id', ma.id, 'file_url', ma.file_url, 'file_type', ma.file_type, 'file_name', ma.file_name))
               FROM message_attachments ma WHERE ma.message_id = m.id) as attachments,
              (SELECT json_agg(json_build_object('emoji', mr.emoji, 'user_id', mr.user_id, 'username', ru.username))
               FROM message_reactions mr JOIN users ru ON ru.id = mr.user_id WHERE mr.message_id = m.id) as reactions
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.channel_id = $1 AND m.is_deleted = FALSE
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [channel.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM messages WHERE channel_id = $1 AND is_deleted = FALSE',
      [channel.id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      messages: messages.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
