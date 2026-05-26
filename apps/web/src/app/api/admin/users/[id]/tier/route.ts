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
    const body = await req.json();

    const user = await db('users').where({ id }).first();
    if (!user) {
      return errorResponse('User not found', 404);
    }

    const updates: Record<string, any> = {};

    if (body.tier) {
      const validTiers = ['FREE', 'MENTORSHIP', 'SOA_CORE', 'INNER_CIRCLE', 'SOA_WEALTH'];
      if (!validTiers.includes(body.tier)) {
        return errorResponse('Invalid tier value', 400);
      }
      updates.tier = body.tier;
    }

    if (body.tier_expires_at !== undefined) {
      updates.tier_expires_at = body.tier_expires_at || null;
    }

    if (body.is_admin !== undefined) {
      updates.is_admin = !!body.is_admin;
    }

    if (body.is_coach !== undefined) {
      updates.is_coach = !!body.is_coach;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse('No valid fields to update', 400);
    }

    const [updatedUser] = await db('users')
      .where({ id })
      .update(updates)
      .returning([
        'id', 'email', 'username', 'display_name', 'tier',
        'tier_expires_at', 'is_admin', 'is_coach',
      ]);

    return NextResponse.json({ user: updatedUser });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
