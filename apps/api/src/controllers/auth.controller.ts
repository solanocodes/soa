import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';
import * as authService from '../services/auth.service';
import db from '../config/database';

export async function register(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, username, display_name, password } = req.body;

    if (!email || !username || !password) {
      throw new AppError('Email, username, and password are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const user = await authService.register(email, username, display_name || null, password);

    const tokenPayload = {
      userId: user.id,
      tier: user.tier,
      isAdmin: user.is_admin,
      isCoach: user.is_coach,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
}

export async function login(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    const user = await authService.login(email, password);

    const tokenPayload = {
      userId: user.id,
      tier: user.tier,
      isAdmin: user.is_admin,
      isCoach: user.is_coach,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({ user, accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const tokens = await authService.refreshToken(refreshToken);

    res.json(tokens);
  } catch (error) {
    next(error);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await db('users')
      .where({ id: req.userId })
      .select(
        'id', 'email', 'username', 'display_name', 'avatar_url',
        'tier', 'tier_expires_at', 'is_admin', 'is_coach',
        'onboarding_day', 'onboarding_completed', 'last_active_at',
        'referral_code', 'referral_credits', 'created_at'
      )
      .first();

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}
