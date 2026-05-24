import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';

const router = Router();

// POST / - send message to channel
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { channel_id, content, reply_to_id, attachments } = req.body;

    if (!channel_id || !content) {
      res.status(400).json({ error: 'channel_id and content are required' });
      return;
    }

    // Verify channel exists and user has access
    const channelResult = await query(
      'SELECT id, required_tier, channel_type FROM channels WHERE id = $1 AND is_archived = FALSE',
      [channel_id]
    );

    if (channelResult.rows.length === 0) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    const channel = channelResult.rows[0];

    // Alert channels are post-restricted to admins/coaches
    if (channel.channel_type === 'alerts' && !req.user!.is_admin && !req.user!.is_coach) {
      res.status(403).json({ error: 'Only coaches can post to alert channels' });
      return;
    }

    const result = await query(
      `INSERT INTO messages (channel_id, user_id, content, reply_to_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, channel_id, user_id, content, reply_to_id, is_pinned, is_deleted, created_at`,
      [channel_id, req.user!.id, content, reply_to_id || null]
    );

    const message = result.rows[0];

    // Handle attachments
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        await query(
          `INSERT INTO message_attachments (message_id, file_url, file_type, file_name, file_size)
           VALUES ($1, $2, $3, $4, $5)`,
          [message.id, att.file_url, att.file_type, att.file_name, att.file_size || null]
        );
      }
    }

    // Fetch full message with user info
    const fullMessage = await query(
      `SELECT m.*, u.username, u.display_name, u.avatar_url, u.tier as user_tier, u.is_admin as user_is_admin, u.is_coach as user_is_coach
       FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = $1`,
      [message.id]
    );

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channel_id}`).emit('new_message', fullMessage.rows[0]);
    }

    res.status(201).json(fullMessage.rows[0]);
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - edit message (own only)
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const existing = await query('SELECT user_id, channel_id FROM messages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.rows[0].user_id !== req.user!.id) {
      res.status(403).json({ error: 'You can only edit your own messages' });
      return;
    }

    const result = await query(
      `UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2
       RETURNING id, channel_id, user_id, content, reply_to_id, is_pinned, is_deleted, edited_at, created_at`,
      [content, id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${existing.rows[0].channel_id}`).emit('message_edited', result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - soft delete message (own or admin)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT user_id, channel_id FROM messages WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (existing.rows[0].user_id !== req.user!.id && !req.user!.is_admin) {
      res.status(403).json({ error: 'You can only delete your own messages' });
      return;
    }

    await query('UPDATE messages SET is_deleted = TRUE WHERE id = $1', [id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${existing.rows[0].channel_id}`).emit('message_deleted', { id });
    }

    res.json({ message: 'Message deleted' });
  } catch (error: any) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/react - add reaction
router.post('/:id/react', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      res.status(400).json({ error: 'Emoji is required' });
      return;
    }

    // Check message exists
    const msgResult = await query('SELECT channel_id FROM messages WHERE id = $1 AND is_deleted = FALSE', [id]);
    if (msgResult.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await query(
      `INSERT INTO message_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [id, req.user!.id, emoji]
    );

    // Get updated reactions
    const reactions = await query(
      `SELECT mr.emoji, mr.user_id, u.username
       FROM message_reactions mr JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = $1`,
      [id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${msgResult.rows[0].channel_id}`).emit('reaction_updated', {
        message_id: id,
        reactions: reactions.rows
      });
    }

    res.json({ reactions: reactions.rows });
  } catch (error: any) {
    console.error('Add reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/react/:emoji - remove reaction
router.delete('/:id/react/:emoji', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id, emoji } = req.params;

    const msgResult = await query('SELECT channel_id FROM messages WHERE id = $1', [id]);
    if (msgResult.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
      [id, req.user!.id, emoji]
    );

    const reactions = await query(
      `SELECT mr.emoji, mr.user_id, u.username
       FROM message_reactions mr JOIN users u ON u.id = mr.user_id
       WHERE mr.message_id = $1`,
      [id]
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${msgResult.rows[0].channel_id}`).emit('reaction_updated', {
        message_id: id,
        reactions: reactions.rows
      });
    }

    res.json({ reactions: reactions.rows });
  } catch (error: any) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/pin - toggle pin (admin only)
router.post('/:id/pin', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT is_pinned, channel_id FROM messages WHERE id = $1 AND is_deleted = FALSE', [id]);
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const newPinned = !existing.rows[0].is_pinned;
    await query('UPDATE messages SET is_pinned = $1 WHERE id = $2', [newPinned, id]);

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${existing.rows[0].channel_id}`).emit('message_pinned', { id, is_pinned: newPinned });
    }

    res.json({ id, is_pinned: newPinned });
  } catch (error: any) {
    console.error('Pin message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
