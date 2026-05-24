import { useEffect } from 'react';
import { useSocketStore } from '@/src/store/socketStore';
import { useAuthStore } from '@/src/store/authStore';

export function useSocket() {
  const { token, isAuthenticated } = useAuthStore();
  const { connect, disconnect, connected, socket } = useSocketStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      connect(token);
    }

    return () => {
      if (!isAuthenticated) {
        disconnect();
      }
    };
  }, [isAuthenticated, token]);

  return {
    connected,
    socket,
    disconnect,
  };
}
