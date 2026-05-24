import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const SOCKET_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  'http://localhost:3000';

let socketInstance: Socket | null = null;
let connectionCount = 0;

async function getSocket(): Promise<Socket> {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  const token = await SecureStore.getItemAsync('accessToken');

  if (socketInstance) {
    socketInstance.auth = { token };
    socketInstance.connect();
    return socketInstance;
  }

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socketInstance;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    connectionCount++;

    let mounted = true;

    const initSocket = async () => {
      const socket = await getSocket();
      if (!mounted) return;

      socketRef.current = socket;

      const onConnect = () => {
        if (mounted) setIsConnected(true);
      };

      const onDisconnect = () => {
        if (mounted) setIsConnected(false);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);

      if (socket.connected) {
        setIsConnected(true);
      }
    };

    initSocket();

    return () => {
      mounted = false;
      connectionCount--;

      if (connectionCount === 0 && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
    };
  }, []);

  return {
    socket: socketRef.current ?? socketInstance,
    isConnected,
  };
}
