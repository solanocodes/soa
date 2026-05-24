import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/database';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import { errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const user = await db('users').where({ email }).first();
    if (!user) {
      return errorResponse('Invalid email or password', 401);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return errorResponse('Invalid email or password', 401);
    }

    // Update last active
    await db('users').where({ id: user.id }).update({ last_active_at: db.fn.now() });

    const { password_hash: _, ...userWithoutPassword } = user;

    const tokenPayload = {
      userId: user.id,
      tier: user.tier,
      isAdmin: user.is_admin,
      isCoach: user.is_coach,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return NextResponse.json({ user: userWithoutPassword, accessToken, refreshToken });
  } catch (err: any) {
    console.error('Login error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
