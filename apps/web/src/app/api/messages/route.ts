import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const { channel_id, content, reply_to_id } = await req.json();

    if (!channel_id || !content) {
      return errorResponse('channel_id and content are required', 400);
    }

    const [message] = await db('messages')
      .insert({
        channel_id,
        user_id: authUser.userId,
        content,
        message_type: 'text',
        reply_to_id: reply_to_id || null,
      })
      .returning('*');

    // Get author info
    const author = await db('users')
      .where({ id: authUser.userId })
      .select('id', 'username', 'display_name', 'avatar_url', 'is_admin', 'is_coach')
      .first();

    const fullMessage = { ...message, author };

    return NextResponse.json({ message: fullMessage }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
