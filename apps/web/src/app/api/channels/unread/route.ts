import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    const user = await db('users').where({ id: authUser.userId }).first();
    if (!user) return errorResponse('User not found', 404);

    const lastActive = user.last_active_at || user.created_at;

    const unreadCounts = await db('messages')
      .select('channel_id')
      .count('id as count')
      .where('created_at', '>', lastActive)
      .where('is_deleted', false)
      .groupBy('channel_id');

    const unread: Record<string, number> = {};
    for (const row of unreadCounts) {
      unread[row.channel_id] = Number(row.count);
    }

    return NextResponse.json({ unread });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
