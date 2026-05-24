import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { hasAccess, Tier } from '@soa/shared';
import db from '../config/database';

export async function listChannels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userTier = (req.userTier || 'FREE') as Tier;

    const channels = await db('channels')
      .where({ is_active: true })
      .orderBy('position', 'asc');

    const accessibleChannels = channels.filter((channel) =>
      hasAccess(userTier, channel.required_tier as Tier)
    );

    res.json({ channels: accessibleChannels });
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { cursor, limit = 50 } = req.query;
    const userTier = (req.userTier || 'FREE') as Tier;

    // Verify channel exists and user has access
    const channel = await db('channels').where({ id }).first();
    if (!channel) {
      throw new AppError('Channel not found', 404);
    }

    if (!hasAccess(userTier, channel.required_tier as Tier)) {
      throw new AppError('Insufficient tier access', 403);
    }

    let query = db('messages')
      .where({ channel_id: id, is_deleted: false })
      .leftJoin('users', 'messages.user_id', 'users.id')
      .select(
        'messages.*',
        'users.username as author_username',
        'users.display_name as author_display_name',
        'users.avatar_url as author_avatar_url',
        'users.is_admin as author_is_admin',
        'users.is_coach as author_is_coach'
      )
      .orderBy([
        { column: 'messages.created_at', order: 'desc' },
        { column: 'messages.id', order: 'desc' },
      ])
      .limit(Math.min(Number(limit), 50));

    if (cursor) {
      const cursorMessage = await db('messages').where({ id: cursor }).first();
      if (cursorMessage) {
        query = query.where(function () {
          this.where('messages.created_at', '<', cursorMessage.created_at)
            .orWhere(function () {
              this.where('messages.created_at', '=', cursorMessage.created_at)
                .andWhere('messages.id', '<', cursorMessage.id);
            });
        });
      }
    }

    const messages = await query;

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      content: msg.content,
      message_type: msg.message_type,
      is_pinned: msg.is_pinned,
      is_deleted: msg.is_deleted,
      reply_to_id: msg.reply_to_id,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      author: {
        id: msg.user_id,
        username: msg.author_username,
        display_name: msg.author_display_name,
        avatar_url: msg.author_avatar_url,
        is_admin: msg.author_is_admin,
        is_coach: msg.author_is_coach,
      },
    }));

    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    res.json({ messages: formattedMessages, nextCursor });
  } catch (error) {
    next(error);
  }
}
