import { useCallback } from 'react';
import { useAuthStore } from '@/src/store/authStore';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    signup,
    logout,
    initialize,
    updateUser,
    clearError,
  } = useAuthStore();

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      await login(email, password);
    },
    [login]
  );

  const handleSignup = useCallback(
    async (email: string, username: string, displayName: string, password: string, referralCode?: string) => {
      await signup(email, username, displayName, password, referralCode);
    },
    [signup]
  );

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    signup: handleSignup,
    logout: handleLogout,
    initialize,
    updateUser,
    clearError,
  };
}
