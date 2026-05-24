import type { Tier } from '../constants/tiers';

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: Tier;
  tier_expires_at: string | null;
  is_admin: boolean;
  is_coach: boolean;
  onboarding_day: number;
  onboarding_completed: boolean;
  last_active_at: string;
  created_at: string;
}

export interface UserProfile extends User {
  referral_code: string;
  referral_credits: number;
  prop_firm_connected: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  username: string;
  display_name?: string;
  password: string;
  referral_code?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
