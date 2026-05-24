import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import db from '../config/database';

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { channel_id, content, reply_to_id } = req.body;

    if (!channel_id || !content) {
      throw new AppError('channel_id and content are required', 400);
    }

    const [message] = await db('messages')
      .insert({
        channel_id,
        user_id: req.userId,
        content,
        message_type: 'text',
        reply_to_id: reply_to_id || null,
      })
      .returning('*');

    // Get author info
    const author = await db('users')
      .where({ id: req.userId })
      .select('id', 'username', 'display_name', 'avatar_url', 'is_admin', 'is_coach')
      .first();

    const fullMessage = { ...message, author };

    // Broadcast to channel room
    const io = req.app.get('io');
    io.to(`channel:${channel_id}`).emit('new_message', fullMessage);

    res.status(201).json({ message: fullMessage });
  } catch (error) {
    next(error);
  }
}

export async function addReaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      throw new AppError('emoji is required', 400);
    }

    const message = await db('messages').where({ id }).first();
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Check for existing reaction
    const existing = await db('message_reactions')
      .where({ message_id: id, user_id: req.userId, emoji })
      .first();

    if (existing) {
      throw new AppError('Already reacted with this emoji', 409);
    }

    await db('message_reactions').insert({
      message_id: id,
      user_id: req.userId,
      emoji,
    });

    const io = req.app.get('io');
    io.to(`channel:${message.channel_id}`).emit('reaction_added', {
      message_id: id,
      user_id: req.userId,
      emoji,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function removeReaction(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id, emoji } = req.params;

    const message = await db('messages').where({ id }).first();
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    const deleted = await db('message_reactions')
      .where({ message_id: id, user_id: req.userId, emoji })
      .del();

    if (!deleted) {
      throw new AppError('Reaction not found', 404);
    }

    const io = req.app.get('io');
    io.to(`channel:${message.channel_id}`).emit('reaction_removed', {
      message_id: id,
      user_id: req.userId,
      emoji,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const message = await db('messages').where({ id }).first();
    if (!message) {
      throw new AppError('Message not found', 404);
    }

    // Only author or admin can delete
    if (message.user_id !== req.userId && !req.isAdmin) {
      throw new AppError('Not authorized to delete this message', 403);
    }

    await db('messages').where({ id }).update({ is_deleted: true });

    const io = req.app.get('io');
    io.to(`channel:${message.channel_id}`).emit('message_deleted', { message_id: id });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
