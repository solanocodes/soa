import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;
    const { emoji } = await req.json();

    if (!emoji) {
      return errorResponse('emoji is required', 400);
    }

    const message = await db('messages').where({ id }).first();
    if (!message) {
      return errorResponse('Message not found', 404);
    }

    // Check for existing reaction
    const existing = await db('message_reactions')
      .where({ message_id: id, user_id: authUser.userId, emoji })
      .first();

    if (existing) {
      return errorResponse('Already reacted with this emoji', 409);
    }

    await db('message_reactions').insert({
      message_id: id,
      user_id: authUser.userId,
      emoji,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;
    const emoji = req.nextUrl.searchParams.get('emoji');

    if (!emoji) {
      return errorResponse('emoji query parameter is required', 400);
    }

    const message = await db('messages').where({ id }).first();
    if (!message) {
      return errorResponse('Message not found', 404);
    }

    const deleted = await db('message_reactions')
      .where({ message_id: id, user_id: authUser.userId, emoji })
      .del();

    if (!deleted) {
      return errorResponse('Reaction not found', 404);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
