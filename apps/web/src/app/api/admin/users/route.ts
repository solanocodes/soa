import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const search = req.nextUrl.searchParams.get('search');
    const tier = req.nextUrl.searchParams.get('tier');
    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    let query = db('users')
      .select(
        'id', 'email', 'username', 'display_name', 'avatar_url',
        'tier', 'tier_expires_at', 'is_admin', 'is_coach',
        'onboarding_day', 'onboarding_completed', 'last_active_at', 'created_at'
      )
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .limit(limit);

    if (search) {
      const searchStr = `%${search}%`;
      query = query.where(function () {
        this.whereILike('username', searchStr)
          .orWhereILike('email', searchStr)
          .orWhereILike('display_name', searchStr);
      });
    }

    if (tier) {
      query = query.where('tier', tier);
    }

    if (cursor) {
      const cursorUser = await db('users').where({ id: cursor }).first();
      if (cursorUser) {
        query = query.where(function () {
          this.where('created_at', '<', cursorUser.created_at)
            .orWhere(function () {
              this.where('created_at', '=', cursorUser.created_at)
                .andWhere('id', '<', cursorUser.id);
            });
        });
      }
    }

    const users = await query;
    const nextCursor = users.length > 0 ? users[users.length - 1].id : null;

    return NextResponse.json({ users, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
