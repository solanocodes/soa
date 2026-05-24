import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  tier: 'free' | 'core' | 'wealth' | 'bot';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });
      const { data } = await api.post('/auth/login', { email, password });

      await SecureStore.setItemAsync('accessToken', data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.refreshToken);

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    try {
      set({ isLoading: true });
      const { data: responseData } = await api.post('/auth/register', data);

      await SecureStore.setItemAsync('accessToken', responseData.accessToken);
      await SecureStore.setItemAsync('refreshToken', responseData.refreshToken);

      set({
        user: responseData.user,
        accessToken: responseData.accessToken,
        refreshToken: responseData.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore logout API errors
    } finally {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  refreshAuth: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const { data } = await api.post('/auth/refresh', { refreshToken });

      await SecureStore.setItemAsync('accessToken', data.accessToken);
      if (data.refreshToken) {
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
      }

      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? get().refreshToken,
        user: data.user ?? get().user,
        isAuthenticated: true,
      });
    } catch {
      get().clearAuth();
    }
  },

  loadStoredAuth: async () => {
    try {
      set({ isLoading: true });

      const accessToken = await SecureStore.getItemAsync('accessToken');
      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      if (!accessToken || !refreshToken) {
        set({ isLoading: false });
        return;
      }

      // Verify token by fetching user profile
      try {
        const { data } = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        set({
          user: data.user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        // Token expired, try refresh
        await get().refreshAuth();
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearAuth: () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));
