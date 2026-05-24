import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '@/src/types';
import { authApi } from '@/src/api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, username: string, displayName: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  initialize: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        set({ token, isLoading: true });
        const { data: user } = await authApi.me();
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('refresh_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await authApi.login(email, password);
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('refresh_token', data.refreshToken);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Login failed. Please try again.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  signup: async (email: string, username: string, displayName: string, password: string, referralCode?: string) => {
    try {
      set({ isLoading: true, error: null });
      const { data } = await authApi.signup({ email, username, displayName, password, referralCode });
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('refresh_token', data.refreshToken);
      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Signup failed. Please try again.';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('refresh_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await authApi.refreshToken(refreshToken);
      await SecureStore.setItemAsync('auth_token', data.token);
      await SecureStore.setItemAsync('refresh_token', data.refreshToken);
      set({ token: data.token });
    } catch {
      await get().logout();
    }
  },

  updateUser: (partial: Partial<User>) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...partial } });
    }
  },

  setUser: (user: User) => set({ user, isAuthenticated: true }),

  setToken: (token: string) => set({ token }),

  clearError: () => set({ error: null }),
}));
