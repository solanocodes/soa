import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

const TIER_HIERARCHY: Record<string, number> = {
  FREE: 0,
  MENTORSHIP: 1,
  SOA_CORE: 1,
  INNER_CIRCLE: 2,
  SOA_WEALTH: 3,
  BOT_PRODUCT: 3,
};

function hasAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_HIERARCHY[userTier] ?? 0) >= (TIER_HIERARCHY[requiredTier] ?? 0);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;
    const userTier = (authUser.tier || 'FREE') as string;

    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    // Verify channel exists
    const channel = await db('channels').where({ id }).first();
    if (!channel) {
      return errorResponse('Channel not found', 404);
    }

    let query = db('messages')
      .where({ channel_id: id, is_deleted: false })
      .leftJoin('users', 'messages.user_id', 'users.id')
      .select(
        'messages.*',
        'users.username as author_username',
        'users.display_name as author_display_name',
        'users.avatar_url as author_avatar_url',
        'users.is_admin as author_is_admin',
        'users.is_coach as author_is_coach'
      )
      .orderBy([
        { column: 'messages.created_at', order: 'desc' },
        { column: 'messages.id', order: 'desc' },
      ])
      .limit(limit);

    if (cursor) {
      const cursorMessage = await db('messages').where({ id: cursor }).first();
      if (cursorMessage) {
        query = query.where(function () {
          this.where('messages.created_at', '<', cursorMessage.created_at)
            .orWhere(function () {
              this.where('messages.created_at', '=', cursorMessage.created_at)
                .andWhere('messages.id', '<', cursorMessage.id);
            });
        });
      }
    }

    const messages = await query;

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      channel_id: msg.channel_id,
      user_id: msg.user_id,
      content: msg.content,
      message_type: msg.message_type,
      is_pinned: msg.is_pinned,
      is_deleted: msg.is_deleted,
      reply_to_id: msg.reply_to_id,
      created_at: msg.created_at,
      updated_at: msg.updated_at,
      author: {
        id: msg.user_id,
        username: msg.author_username,
        display_name: msg.author_display_name,
        avatar_url: msg.author_avatar_url,
        is_admin: msg.author_is_admin,
        is_coach: msg.author_is_coach,
      },
    }));

    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    // Update the user's last_active_at timestamp
    await db('users').where({ id: authUser.userId }).update({ last_active_at: db.fn.now() });

    return NextResponse.json({ messages: formattedMessages, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
