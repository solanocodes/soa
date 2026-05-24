import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

const TIERS = ['FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT'] as const;
type Tier = (typeof TIERS)[number];

const TIER_HIERARCHY: Record<Tier, number> = {
  FREE: 0,
  SOA_CORE: 1,
  SOA_WEALTH: 2,
  BOT_PRODUCT: 3,
};

function hasAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;
    const userTier = (authUser.tier || 'FREE') as Tier;

    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    // Verify channel exists and user has access
    const channel = await db('channels').where({ id }).first();
    if (!channel) {
      return errorResponse('Channel not found', 404);
    }

    if (!hasAccess(userTier, channel.required_tier as Tier)) {
      return errorResponse('Insufficient tier access', 403);
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

    return NextResponse.json({ messages: formattedMessages, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
