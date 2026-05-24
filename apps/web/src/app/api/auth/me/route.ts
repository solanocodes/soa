import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    const user = await db('users')
      .where({ id: authUser.userId })
      .select(
        'id', 'email', 'username', 'display_name', 'avatar_url',
        'tier', 'tier_expires_at', 'is_admin', 'is_coach',
        'onboarding_day', 'onboarding_completed', 'last_active_at',
        'referral_code', 'referral_credits', 'created_at'
      )
      .first();

    if (!user) {
      return errorResponse('User not found', 404);
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
