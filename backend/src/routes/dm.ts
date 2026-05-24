import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticate, AuthRequest, requireAdmin } from '../middleware/auth';
import { paginationParams } from '../utils/helpers';

const router = Router();

// GET /threads - list user's DM threads
router.get('/threads', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const threads = await query(
      `SELECT dmt.id, dmt.ai_mode, dmt.last_message_at, dmt.created_at,
              CASE
                WHEN dmt.participant_1 = $1 THEN dmt.participant_2
                ELSE dmt.participant_1
              END as other_user_id,
              CASE
                WHEN dmt.participant_1 = $1 THEN u2.username
                ELSE u1.username
              END as other_username,
              CASE
                WHEN dmt.participant_1 = $1 THEN u2.display_name
                ELSE u1.display_name
              END as other_display_name,
              CASE
                WHEN dmt.participant_1 = $1 THEN u2.avatar_url
                ELSE u1.avatar_url
              END as other_avatar_url,
              CASE
                WHEN dmt.participant_1 = $1 THEN u2.tier
                ELSE u1.tier
              END as other_tier,
              (SELECT dm.content FROM direct_messages dm WHERE dm.thread_id = dmt.id AND (dm.ai_approved IS NULL OR dm.ai_approved = TRUE) ORDER BY dm.created_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM direct_messages dm WHERE dm.thread_id = dmt.id AND dm.sender_id != $1 AND dm.is_read = FALSE AND (dm.ai_approved IS NULL OR dm.ai_approved = TRUE)) as unread_count
       FROM direct_message_threads dmt
       JOIN users u1 ON u1.id = dmt.participant_1
       JOIN users u2 ON u2.id = dmt.participant_2
       WHERE dmt.participant_1 = $1 OR dmt.participant_2 = $1
       ORDER BY dmt.last_message_at DESC NULLS LAST`,
      [req.user!.id]
    );

    res.json({ threads: threads.rows });
  } catch (error: any) {
    console.error('Get DM threads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /threads/:id/messages - get messages in thread
router.get('/threads/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { offset, limit, page } = paginationParams(req.query as any);

    // Verify user is a participant
    const thread = await query(
      'SELECT * FROM direct_message_threads WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)',
      [id, req.user!.id]
    );
    if (thread.rows.length === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    // Mark messages as read
    await query(
      `UPDATE direct_messages SET is_read = TRUE
       WHERE thread_id = $1 AND sender_id != $2 AND is_read = FALSE`,
      [id, req.user!.id]
    );

    const messages = await query(
      `SELECT dm.id, dm.sender_id, dm.content, dm.is_ai_generated, dm.ai_approved, dm.is_read, dm.created_at,
              u.username, u.display_name, u.avatar_url
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE dm.thread_id = $1 AND (dm.ai_approved IS NULL OR dm.ai_approved = TRUE OR dm.sender_id = $2)
       ORDER BY dm.created_at DESC
       LIMIT $3 OFFSET $4`,
      [id, req.user!.id, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM direct_messages WHERE thread_id = $1 AND (ai_approved IS NULL OR ai_approved = TRUE)',
      [id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      thread: thread.rows[0],
      messages: messages.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error: any) {
    console.error('Get DM messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /threads/:id/messages - send message in thread
router.post('/threads/:id/messages', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    // Verify user is a participant
    const thread = await query(
      'SELECT * FROM direct_message_threads WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)',
      [id, req.user!.id]
    );
    if (thread.rows.length === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const result = await query(
      `INSERT INTO direct_messages (thread_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, req.user!.id, content]
    );

    // Update thread last_message_at
    await query('UPDATE direct_message_threads SET last_message_at = NOW() WHERE id = $1', [id]);

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`dm:${id}`).emit('new_dm', {
        ...result.rows[0],
        username: req.user!.username,
        display_name: req.user!.display_name,
        avatar_url: req.user!.avatar_url,
      });
    }

    // If AI mode is 'auto' or 'draft', trigger AI response
    const threadData = thread.rows[0];
    if (threadData.ai_mode === 'auto' || threadData.ai_mode === 'draft') {
      // Determine which participant is not the sender (to respond as)
      const coachId = threadData.participant_1 === req.user!.id ? threadData.participant_2 : threadData.participant_1;

      // Only trigger AI if message is from the student (not the coach)
      const coachUser = await query('SELECT is_admin, is_coach FROM users WHERE id = $1', [coachId]);
      if (coachUser.rows.length > 0 && (coachUser.rows[0].is_admin || coachUser.rows[0].is_coach)) {
        // Get thread context
        const contextMessages = await query(
          `SELECT sender_id, content FROM direct_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [id]
        );

        const { generateCoachResponse } = require('../services/ai');
        const aiResponse = await generateCoachResponse(content, contextMessages.rows.reverse());

        if (aiResponse) {
          const aiMsg = await query(
            `INSERT INTO direct_messages (thread_id, sender_id, content, is_ai_generated, ai_approved)
             VALUES ($1, $2, $3, TRUE, $4)
             RETURNING *`,
            [id, coachId, aiResponse, threadData.ai_mode === 'auto' ? true : null]
          );

          if (threadData.ai_mode === 'auto') {
            await query('UPDATE direct_message_threads SET last_message_at = NOW() WHERE id = $1', [id]);
            if (io) {
              io.to(`dm:${id}`).emit('new_dm', aiMsg.rows[0]);
            }
          }
        }
      }
    }

    // Send push notification to other participant
    const otherUserId = threadData.participant_1 === req.user!.id ? threadData.participant_2 : threadData.participant_1;
    const { sendPushNotification } = require('../services/notifications');
    await sendPushNotification(
      otherUserId,
      `DM from ${req.user!.display_name}`,
      content.substring(0, 100),
      { type: 'dm', thread_id: id }
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /threads/:id/ai-mode - update AI mode (admin only)
router.put('/threads/:id/ai-mode', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { ai_mode, ai_persona } = req.body;

    if (!ai_mode || !['off', 'draft', 'auto'].includes(ai_mode)) {
      res.status(400).json({ error: 'Valid ai_mode is required (off, draft, auto)' });
      return;
    }

    const result = await query(
      `UPDATE direct_message_threads SET ai_mode = $1, ai_persona = $2 WHERE id = $3 RETURNING *`,
      [ai_mode, ai_persona || null, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update AI mode error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
