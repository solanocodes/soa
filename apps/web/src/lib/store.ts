'use client';

import { create } from 'zustand';
import { api } from './api';

interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: string;
  tier_expires_at: string | null;
  is_admin: boolean;
  is_coach: boolean;
  created_at: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('soa_access_token', data.accessToken);
    localStorage.setItem('soa_refresh_token', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (email, username, displayName, password) => {
    const { data } = await api.post('/auth/register', {
      email,
      username,
      display_name: displayName,
      password,
    });
    localStorage.setItem('soa_access_token', data.accessToken);
    localStorage.setItem('soa_refresh_token', data.refreshToken);
    set({ user: data.user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('soa_access_token');
    localStorage.removeItem('soa_refresh_token');
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('soa_access_token');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('soa_access_token');
      localStorage.removeItem('soa_refresh_token');
      set({ isLoading: false });
    }
  },
}));
