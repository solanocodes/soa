import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userTier?: string;
}

export function setupSocket(io: Server) {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
        tier: string;
      };
      socket.userId = payload.userId;
      socket.userTier = payload.tier;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userId}`);

    socket.on('join_channel', (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });

    socket.on('leave_channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('typing_start', (data: { channelId: string; username: string }) => {
      socket.to(`channel:${data.channelId}`).emit('user_typing', {
        userId: socket.userId,
        username: data.username,
        channelId: data.channelId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', (data: { channelId: string; username: string }) => {
      socket.to(`channel:${data.channelId}`).emit('user_typing', {
        userId: socket.userId,
        username: data.username,
        channelId: data.channelId,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}
