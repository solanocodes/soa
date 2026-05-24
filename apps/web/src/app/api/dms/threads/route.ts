import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    const threads = await db('direct_message_threads')
      .where('student_id', authUser.userId)
      .orWhere('coach_id', authUser.userId)
      .orderBy('last_message_at', 'desc');

    const threadsWithDetails = await Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.student_id === authUser.userId
          ? thread.coach_id
          : thread.student_id;

        const otherUser = await db('users')
          .where({ id: otherUserId })
          .select('id', 'username', 'display_name', 'avatar_url')
          .first();

        const lastMessage = await db('direct_messages')
          .where({ thread_id: thread.id })
          .orderBy('created_at', 'desc')
          .first();

        const unreadCount = await db('direct_messages')
          .where({ thread_id: thread.id, is_read: false })
          .andWhereNot('sender_id', authUser.userId)
          .count('id as count')
          .first();

        return {
          ...thread,
          other_user: otherUser,
          last_message: lastMessage || null,
          unread_count: Number(unreadCount?.count || 0),
        };
      })
    );

    return NextResponse.json({ threads: threadsWithDetails });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const { coach_id } = await req.json();

    if (!coach_id) {
      return errorResponse('coach_id is required', 400);
    }

    // Verify coach exists and is actually a coach
    const coach = await db('users').where({ id: coach_id }).first();
    if (!coach || (!coach.is_coach && !coach.is_admin)) {
      return errorResponse('Invalid coach', 400);
    }

    // Check if thread already exists
    const existing = await db('direct_message_threads')
      .where({ student_id: authUser.userId, coach_id })
      .first();

    if (existing) {
      return NextResponse.json({ thread: existing });
    }

    const [thread] = await db('direct_message_threads')
      .insert({
        student_id: authUser.userId,
        coach_id,
        ai_mode: 'suggest',
        last_message_at: db.fn.now(),
      })
      .returning('*');

    return NextResponse.json({ thread }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
