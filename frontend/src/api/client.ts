import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import {
  User,
  Channel,
  Message,
  Alert,
  JournalEntry,
  Win,
  Course,
  PaginatedResponse,
  DirectMessageThread,
  DirectMessage,
  LiveSession,
  UserStats,
} from '@/src/types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        await SecureStore.setItemAsync('auth_token', data.token);
        await SecureStore.setItemAsync('refresh_token', data.refreshToken);

        processQueue(null, data.token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string; refreshToken: string }>('/auth/login', { email, password }),

  signup: (data: { email: string; username: string; displayName: string; password: string; referralCode?: string }) =>
    api.post<{ user: User; token: string; refreshToken: string }>('/auth/signup', data),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<{ token: string; refreshToken: string }>('/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  me: () => api.get<User>('/auth/me'),
};

// Channels API
export const channelsApi = {
  list: () => api.get<Channel[]>('/channels'),

  getBySlug: (slug: string) => api.get<Channel>(`/channels/${slug}`),

  join: (channelId: string) => api.post(`/channels/${channelId}/join`),

  leave: (channelId: string) => api.post(`/channels/${channelId}/leave`),
};

// Messages API
export const messagesApi = {
  list: (channelId: string, page = 1, limit = 50) =>
    api.get<PaginatedResponse<Message>>(`/channels/${channelId}/messages`, {
      params: { page, limit },
    }),

  send: (channelId: string, content: string, attachments?: string[]) =>
    api.post<Message>(`/channels/${channelId}/messages`, { content, attachments }),

  react: (messageId: string, emoji: string) =>
    api.post(`/messages/${messageId}/react`, { emoji }),

  unreact: (messageId: string, emoji: string) =>
    api.delete(`/messages/${messageId}/react`, { data: { emoji } }),

  pin: (messageId: string) => api.post(`/messages/${messageId}/pin`),

  unpin: (messageId: string) => api.delete(`/messages/${messageId}/pin`),

  delete: (messageId: string) => api.delete(`/messages/${messageId}`),
};

// Alerts API
export const alertsApi = {
  list: (category?: string, page = 1, limit = 30) =>
    api.get<PaginatedResponse<Alert>>('/alerts', {
      params: { category, page, limit },
    }),

  getById: (id: string) => api.get<Alert>(`/alerts/${id}`),
};

// Journal API
export const journalApi = {
  list: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<JournalEntry>>('/journal', { params: { page, limit } }),

  getById: (id: string) => api.get<JournalEntry>(`/journal/${id}`),

  create: (data: Partial<JournalEntry>) => api.post<JournalEntry>('/journal', data),

  update: (id: string, data: Partial<JournalEntry>) =>
    api.put<JournalEntry>(`/journal/${id}`, data),

  delete: (id: string) => api.delete(`/journal/${id}`),

  stats: () => api.get<UserStats>('/journal/stats'),
};

// Wins API
export const winsApi = {
  list: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Win>>('/wins', { params: { page, limit } }),

  create: (data: { caption: string; pnl: number; screenshot?: string }) =>
    api.post<Win>('/wins', data),

  like: (id: string) => api.post(`/wins/${id}/like`),

  unlike: (id: string) => api.delete(`/wins/${id}/like`),
};

// Courses API
export const coursesApi = {
  list: () => api.get<Course[]>('/courses'),

  getById: (id: string) => api.get<Course>(`/courses/${id}`),

  completeModule: (courseId: string, moduleId: string) =>
    api.post(`/courses/${courseId}/modules/${moduleId}/complete`),
};

// DMs API
export const dmsApi = {
  listThreads: () => api.get<DirectMessageThread[]>('/dm/threads'),

  getThread: (threadId: string) => api.get<DirectMessageThread>(`/dm/threads/${threadId}`),

  getMessages: (threadId: string, page = 1, limit = 50) =>
    api.get<PaginatedResponse<DirectMessage>>(`/dm/threads/${threadId}/messages`, {
      params: { page, limit },
    }),

  sendMessage: (threadId: string, content: string, attachments?: string[]) =>
    api.post<DirectMessage>(`/dm/threads/${threadId}/messages`, { content, attachments }),

  createThread: (userId: string) =>
    api.post<DirectMessageThread>('/dm/threads', { userId }),
};

// Live Sessions API
export const liveSessionsApi = {
  list: () => api.get<LiveSession[]>('/live-sessions'),

  getById: (id: string) => api.get<LiveSession>(`/live-sessions/${id}`),
};

// Upload API
export const uploadApi = {
  uploadImage: (formData: FormData) =>
    api.post<{ url: string; thumbnailUrl: string }>('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// User API
export const userApi = {
  updateProfile: (data: Partial<User>) => api.put<User>('/user/profile', data),

  updateAvatar: (formData: FormData) =>
    api.put<{ avatarUrl: string }>('/user/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getStats: () => api.get<UserStats>('/user/stats'),

  getReferralStats: () =>
    api.get<{ referralCount: number; earnings: number }>('/user/referrals'),
};

export default api;
