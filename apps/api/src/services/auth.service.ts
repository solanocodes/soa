import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { scheduleOnboarding } from '../jobs';

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex'); // 8 hex chars
}

export async function register(
  email: string,
  username: string,
  display_name: string | null,
  password: string
) {
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    throw new AppError('Email already registered', 409);
  }

  const existingUsername = await db('users').where({ username }).first();
  if (existingUsername) {
    throw new AppError('Username already taken', 409);
  }

  const password_hash = await bcrypt.hash(password, 12);
  const referral_code = generateReferralCode();

  const [user] = await db('users')
    .insert({
      email,
      username,
      display_name,
      password_hash,
      referral_code,
      tier: 'FREE',
      is_admin: false,
      is_coach: false,
      onboarding_day: 0,
      onboarding_completed: false,
    })
    .returning('*');

  const { password_hash: _, ...userWithoutPassword } = user;

  // Schedule onboarding automation events
  scheduleOnboarding(user.id).catch(err => {
    console.error('Failed to schedule onboarding:', err);
  });

  return userWithoutPassword;
}

export async function login(email: string, password: string) {
  const user = await db('users').where({ email }).first();
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Update last active
  await db('users').where({ id: user.id }).update({ last_active_at: db.fn.now() });

  const { password_hash: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function refreshToken(token: string) {
  const payload = verifyRefreshToken(token);

  const user = await db('users').where({ id: payload.userId }).first();
  if (!user) {
    throw new AppError('User not found', 401);
  }

  const tokenPayload = {
    userId: user.id,
    tier: user.tier,
    isAdmin: user.is_admin,
    isCoach: user.is_coach,
  };

  return {
    accessToken: generateAccessToken(tokenPayload),
    refreshToken: generateRefreshToken(tokenPayload),
  };
}
