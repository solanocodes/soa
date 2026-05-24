import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { tierMeetsRequirement } from '../utils/helpers';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: {
    id: string;
    username: string;
    display_name: string;
    tier: string;
    is_admin: boolean;
    is_coach: boolean;
  };
}

export function initSocket(io: SocketServer) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(
        token as string,
        process.env.JWT_SECRET || 'fallback-secret'
      ) as { userId: string };

      const result = await query(
        'SELECT id, username, display_name, tier, is_admin, is_coach FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.user = result.rows[0];
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.user?.username} (${socket.userId})`);

    // Join user's accessible channels
    const channels = await query(
      'SELECT id, slug, required_tier FROM channels WHERE is_archived = FALSE'
    );

    for (const channel of channels.rows) {
      const hasAccess = socket.user!.is_admin || socket.user!.is_coach ||
        tierMeetsRequirement(socket.user!.tier, channel.required_tier);
      if (hasAccess) {
        socket.join(`channel:${channel.id}`);
      }
    }

    // Join user's DM threads
    const dmThreads = await query(
      'SELECT id FROM direct_message_threads WHERE participant_1 = $1 OR participant_2 = $1',
      [socket.userId]
    );
    for (const thread of dmThreads.rows) {
      socket.join(`dm:${thread.id}`);
    }

    // Join personal room for direct notifications
    socket.join(`user:${socket.userId}`);

    // Handle join_channel
    socket.on('join_channel', async (data: { channel_id: string }) => {
      const { channel_id } = data;

      const channelResult = await query(
        'SELECT id, required_tier FROM channels WHERE id = $1',
        [channel_id]
      );
      if (channelResult.rows.length === 0) return;

      const channel = channelResult.rows[0];
      const hasAccess = socket.user!.is_admin || socket.user!.is_coach ||
        tierMeetsRequirement(socket.user!.tier, channel.required_tier);

      if (hasAccess) {
        socket.join(`channel:${channel_id}`);
      }
    });

    // Handle leave_channel
    socket.on('leave_channel', (data: { channel_id: string }) => {
      socket.leave(`channel:${data.channel_id}`);
    });

    // Handle send_message
    socket.on('send_message', async (data: { channel_id: string; content: string; reply_to_id?: string }) => {
      try {
        const { channel_id, content, reply_to_id } = data;

        if (!channel_id || !content) return;

        // Verify channel access
        const channelResult = await query(
          'SELECT id, required_tier, channel_type FROM channels WHERE id = $1',
          [channel_id]
        );
        if (channelResult.rows.length === 0) return;

        const channel = channelResult.rows[0];

        // Alert channels restricted to coaches
        if (channel.channel_type === 'alerts' && !socket.user!.is_admin && !socket.user!.is_coach) return;

        const hasAccess = socket.user!.is_admin || socket.user!.is_coach ||
          tierMeetsRequirement(socket.user!.tier, channel.required_tier);
        if (!hasAccess) return;

        // Save to DB
        const result = await query(
          `INSERT INTO messages (channel_id, user_id, content, reply_to_id)
           VALUES ($1, $2, $3, $4)
           RETURNING id, channel_id, user_id, content, reply_to_id, is_pinned, is_deleted, created_at`,
          [channel_id, socket.userId, content, reply_to_id || null]
        );

        const message = {
          ...result.rows[0],
          username: socket.user!.username,
          display_name: socket.user!.display_name,
          user_tier: socket.user!.tier,
          user_is_admin: socket.user!.is_admin,
          user_is_coach: socket.user!.is_coach,
        };

        // Broadcast to channel
        io.to(`channel:${channel_id}`).emit('new_message', message);
      } catch (error) {
        console.error('Socket send_message error:', error);
      }
    });

    // Handle send_alert
    socket.on('send_alert', async (data: {
      channel_id: string; ticker: string; direction?: string;
      entry_price?: number; stop_loss?: number; take_profit?: number;
      setup_type?: string; notes?: string; screenshot_url?: string;
    }) => {
      try {
        if (!socket.user!.is_admin && !socket.user!.is_coach) return;

        const { channel_id, ticker, direction, entry_price, stop_loss, take_profit, setup_type, notes, screenshot_url } = data;

        if (!channel_id || !ticker) return;

        const result = await query(
          `INSERT INTO alerts (channel_id, user_id, ticker, direction, entry_price, stop_loss, take_profit, setup_type, notes, screenshot_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [channel_id, socket.userId, ticker.toUpperCase(), direction || null, entry_price || null, stop_loss || null, take_profit || null, setup_type || null, notes || null, screenshot_url || null]
        );

        const alert = {
          ...result.rows[0],
          username: socket.user!.username,
          display_name: socket.user!.display_name,
        };

        io.to(`channel:${channel_id}`).emit('new_alert', alert);

        // Also post as message
        const msgContent = `🚨 **${ticker.toUpperCase()}** ${direction || ''} @ ${entry_price || 'Market'}\n${notes || ''}`;
        await query(
          'INSERT INTO messages (channel_id, user_id, content) VALUES ($1, $2, $3)',
          [channel_id, socket.userId, msgContent]
        );
      } catch (error) {
        console.error('Socket send_alert error:', error);
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data: { channel_id: string }) => {
      socket.to(`channel:${data.channel_id}`).emit('user_typing', {
        channel_id: data.channel_id,
        user_id: socket.userId,
        username: socket.user!.username,
        display_name: socket.user!.display_name,
      });
    });

    socket.on('typing_stop', (data: { channel_id: string }) => {
      socket.to(`channel:${data.channel_id}`).emit('user_stopped_typing', {
        channel_id: data.channel_id,
        user_id: socket.userId,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.username}`);
    });
  });
}
