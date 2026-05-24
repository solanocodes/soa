import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);

    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const { id } = params;
    const { tier, tier_expires_at } = await req.json();

    if (!tier) {
      return errorResponse('tier is required', 400);
    }

    const validTiers = ['FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT'];
    if (!validTiers.includes(tier)) {
      return errorResponse('Invalid tier value', 400);
    }

    const user = await db('users').where({ id }).first();
    if (!user) {
      return errorResponse('User not found', 404);
    }

    const [updatedUser] = await db('users')
      .where({ id })
      .update({
        tier,
        tier_expires_at: tier_expires_at || null,
      })
      .returning([
        'id', 'email', 'username', 'display_name', 'tier',
        'tier_expires_at', 'is_admin', 'is_coach',
      ]);

    return NextResponse.json({ user: updatedUser });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
