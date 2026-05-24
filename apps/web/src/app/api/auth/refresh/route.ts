import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return errorResponse('Refresh token is required', 400);
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return errorResponse('Invalid or expired refresh token', 401);
    }

    const user = await db('users').where({ id: payload.userId }).first();
    if (!user) {
      return errorResponse('User not found', 401);
    }

    const tokenPayload = {
      userId: user.id,
      tier: user.tier,
      isAdmin: user.is_admin,
      isCoach: user.is_coach,
    };

    return NextResponse.json({
      accessToken: generateAccessToken(tokenPayload),
      refreshToken: generateRefreshToken(tokenPayload),
    });
  } catch (err: any) {
    console.error('Refresh error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}
