import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { Message } from '@/src/types';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface SocketState {
  socket: Socket | null;
  connected: boolean;
  activeChannel: string | null;
  typingUsers: Record<string, string[]>;

  connect: (token: string) => void;
  disconnect: () => void;
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  sendTyping: (channelId: string) => void;
  onNewMessage: (callback: (message: Message) => void) => void;
  offNewMessage: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  connected: false,
  activeChannel: null,
  typingUsers: {},

  connect: (token: string) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('user:typing', ({ channelId, username }: { channelId: string; username: string }) => {
      const current = get().typingUsers;
      const channelTyping = current[channelId] || [];
      if (!channelTyping.includes(username)) {
        set({ typingUsers: { ...current, [channelId]: [...channelTyping, username] } });
        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          const updated = get().typingUsers;
          const filtered = (updated[channelId] || []).filter((u) => u !== username);
          set({ typingUsers: { ...updated, [channelId]: filtered } });
        }, 3000);
      }
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, activeChannel: null });
    }
  },

  joinChannel: (channelId: string) => {
    const { socket, activeChannel } = get();
    if (!socket) return;

    if (activeChannel) {
      socket.emit('channel:leave', { channelId: activeChannel });
    }

    socket.emit('channel:join', { channelId });
    set({ activeChannel: channelId });
  },

  leaveChannel: (channelId: string) => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('channel:leave', { channelId });
    set({ activeChannel: null });
  },

  sendTyping: (channelId: string) => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('channel:typing', { channelId });
  },

  onNewMessage: (callback: (message: Message) => void) => {
    const { socket } = get();
    if (!socket) return;
    socket.on('message:new', callback);
  },

  offNewMessage: () => {
    const { socket } = get();
    if (!socket) return;
    socket.off('message:new');
  },
}));
