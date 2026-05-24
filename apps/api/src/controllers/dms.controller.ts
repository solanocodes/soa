import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import db from '../config/database';
import { generateAIResponse } from '../services/ai.service';

export async function listThreads(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const threads = await db('direct_message_threads')
      .where('student_id', req.userId)
      .orWhere('coach_id', req.userId)
      .orderBy('last_message_at', 'desc');

    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.student_id === req.userId
          ? thread.coach_id
          : thread.student_id;

        const otherUser = await db('users')
          .where({ id: otherUserId })
          .select('id', 'username', 'display_name', 'avatar_url')
          .first();

        const lastMessage = await db('direct_messages')
          .where({ thread_id: thread.id })
          .orderBy('created_at', 'desc')
          .first();

        const unreadCount = await db('direct_messages')
          .where({ thread_id: thread.id, is_read: false })
          .andWhereNot('sender_id', req.userId)
          .count('id as count')
          .first();

        return {
          ...thread,
          other_user: otherUser,
          last_message: lastMessage || null,
          unread_count: Number(unreadCount?.count || 0),
        };
      })
    );

    res.json({ threads: threadsWithDetails });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { threadId } = req.params;
    const { cursor, limit = 50 } = req.query;

    // Verify user is participant
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      throw new AppError('Thread not found', 404);
    }

    if (thread.student_id !== req.userId && thread.coach_id !== req.userId) {
      throw new AppError('Not authorized to view this thread', 403);
    }

    let query = db('direct_messages')
      .where({ thread_id: threadId })
      .leftJoin('users', 'direct_messages.sender_id', 'users.id')
      .select(
        'direct_messages.*',
        'users.username as sender_username',
        'users.display_name as sender_display_name',
        'users.avatar_url as sender_avatar_url'
      )
      .orderBy([
        { column: 'direct_messages.created_at', order: 'desc' },
        { column: 'direct_messages.id', order: 'desc' },
      ])
      .limit(Math.min(Number(limit), 50));

    if (cursor) {
      const cursorMsg = await db('direct_messages').where({ id: cursor }).first();
      if (cursorMsg) {
        query = query.where(function () {
          this.where('direct_messages.created_at', '<', cursorMsg.created_at)
            .orWhere(function () {
              this.where('direct_messages.created_at', '=', cursorMsg.created_at)
                .andWhere('direct_messages.id', '<', cursorMsg.id);
            });
        });
      }
    }

    const messages = await query;

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      thread_id: msg.thread_id,
      sender_id: msg.sender_id,
      content: msg.content,
      is_ai_generated: msg.is_ai_generated,
      ai_confidence: msg.ai_confidence,
      was_edited_before_send: msg.was_edited_before_send,
      is_read: msg.is_read,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id,
        username: msg.sender_username,
        display_name: msg.sender_display_name,
        avatar_url: msg.sender_avatar_url,
      },
    }));

    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    res.json({ messages: formattedMessages, nextCursor });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { threadId } = req.params;
    const { content } = req.body;

    if (!content) {
      throw new AppError('content is required', 400);
    }

    // Verify user is participant
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      throw new AppError('Thread not found', 404);
    }

    if (thread.student_id !== req.userId && thread.coach_id !== req.userId) {
      throw new AppError('Not authorized to send in this thread', 403);
    }

    const [message] = await db('direct_messages')
      .insert({
        thread_id: threadId,
        sender_id: req.userId,
        content,
        is_ai_generated: false,
        is_read: false,
      })
      .returning('*');

    // Update thread last_message_at
    await db('direct_message_threads')
      .where({ id: threadId })
      .update({ last_message_at: db.fn.now() });

    // Mark previous messages from other user as read
    await db('direct_messages')
      .where({ thread_id: threadId, is_read: false })
      .andWhereNot('sender_id', req.userId)
      .update({ is_read: true });

    // Get sender info
    const sender = await db('users')
      .where({ id: req.userId })
      .select('id', 'username', 'display_name', 'avatar_url')
      .first();

    const fullMessage = { ...message, sender };

    // Broadcast via socket
    const io = req.app.get('io');
    io.to(`dm:${threadId}`).emit('dm_new_message', fullMessage);

    // If student sent message to coach, trigger AI response
    if (req.userId === thread.student_id && thread.ai_mode !== 'off') {
      try {
        const recentMessages = await db('direct_messages')
          .where({ thread_id: threadId })
          .orderBy('created_at', 'desc')
          .limit(10);

        const history = recentMessages.reverse().map(m => ({
          role: (m.sender_id === thread.student_id ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));

        const { response: aiResponse, confidence } = await generateAIResponse(content, history);

        if (thread.ai_mode === 'autopilot' && confidence >= 0.7) {
          const [aiMessage] = await db('direct_messages')
            .insert({
              thread_id: threadId,
              sender_id: thread.coach_id,
              content: aiResponse,
              is_ai_generated: true,
              ai_confidence: confidence,
              is_read: false,
            })
            .returning('*');

          const coachInfo = await db('users')
            .where({ id: thread.coach_id })
            .select('id', 'username', 'display_name', 'avatar_url')
            .first();

          io.to(`dm:${threadId}`).emit('dm_new_message', { ...aiMessage, sender: coachInfo });
        } else {
          // In suggest mode, store as pending for coach review
          await db('direct_messages')
            .insert({
              thread_id: threadId,
              sender_id: thread.coach_id,
              content: aiResponse,
              is_ai_generated: true,
              ai_confidence: confidence,
              was_edited_before_send: false,
              is_read: false,
            });
        }
      } catch (aiErr) {
        console.error('AI response generation failed:', aiErr);
      }
    }

    res.status(201).json({ message: fullMessage });
  } catch (error) {
    next(error);
  }
}

export async function createThread(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { coach_id } = req.body;

    if (!coach_id) {
      throw new AppError('coach_id is required', 400);
    }

    // Verify coach exists and is actually a coach
    const coach = await db('users').where({ id: coach_id }).first();
    if (!coach || (!coach.is_coach && !coach.is_admin)) {
      throw new AppError('Invalid coach', 400);
    }

    // Check if thread already exists
    const existing = await db('direct_message_threads')
      .where({ student_id: req.userId, coach_id })
      .first();

    if (existing) {
      return res.json({ thread: existing });
    }

    const [thread] = await db('direct_message_threads')
      .insert({
        student_id: req.userId,
        coach_id,
        ai_mode: 'suggest',
        last_message_at: db.fn.now(),
      })
      .returning('*');

    res.status(201).json({ thread });
  } catch (error) {
    next(error);
  }
}
