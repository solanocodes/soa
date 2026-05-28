import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { threadId } = params;

    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    // Verify user is participant
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      return errorResponse('Thread not found', 404);
    }

    if (thread.student_id !== authUser.userId && thread.coach_id !== authUser.userId) {
      return errorResponse('Not authorized to view this thread', 403);
    }

    let query = db('direct_messages')
      .where({ thread_id: threadId })
      .where(function () {
        // Hide pending AI suggestions from the main message feed
        this.where('is_pending', false).orWhereNull('is_pending');
      })
      .leftJoin('users', 'direct_messages.sender_id', 'users.id')
      .select(
        'direct_messages.*',
        'users.username as sender_username',
        'users.display_name as sender_display_name',
        'users.avatar_url as sender_avatar_url'
      )
      .orderBy([
        { column: 'direct_messages.created_at', order: 'desc' },
        { column: 'direct_messages.id', order: 'desc' },
      ])
      .limit(limit);

    if (cursor) {
      const cursorMsg = await db('direct_messages').where({ id: cursor }).first();
      if (cursorMsg) {
        query = query.where(function () {
          this.where('direct_messages.created_at', '<', cursorMsg.created_at)
            .orWhere(function () {
              this.where('direct_messages.created_at', '=', cursorMsg.created_at)
                .andWhere('direct_messages.id', '<', cursorMsg.id);
            });
        });
      }
    }

    const messages = await query;

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      thread_id: msg.thread_id,
      sender_id: msg.sender_id,
      content: msg.content,
      is_ai_generated: msg.is_ai_generated,
      ai_confidence: msg.ai_confidence,
      was_edited_before_send: msg.was_edited_before_send,
      is_read: msg.is_read,
      created_at: msg.created_at,
      sender: {
        id: msg.sender_id,
        username: msg.sender_username,
        display_name: msg.sender_display_name,
        avatar_url: msg.sender_avatar_url,
      },
    }));

    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    return NextResponse.json({ messages: formattedMessages, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { threadId } = params;
    const { content } = await req.json();

    if (!content) {
      return errorResponse('content is required', 400);
    }

    // Verify user is participant
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      return errorResponse('Thread not found', 404);
    }

    if (thread.student_id !== authUser.userId && thread.coach_id !== authUser.userId) {
      return errorResponse('Not authorized to send in this thread', 403);
    }

    const [message] = await db('direct_messages')
      .insert({
        thread_id: threadId,
        sender_id: authUser.userId,
        content,
        is_ai_generated: false,
        is_pending: false,
        is_read: false,
      })
      .returning('*');

    // Update thread last_message_at
    await db('direct_message_threads')
      .where({ id: threadId })
      .update({ last_message_at: db.fn.now() });

    // Mark previous messages from other user as read
    await db('direct_messages')
      .where({ thread_id: threadId, is_read: false })
      .andWhereNot('sender_id', authUser.userId)
      .update({ is_read: true });

    // Get sender info
    const sender = await db('users')
      .where({ id: authUser.userId })
      .select('id', 'username', 'display_name', 'avatar_url')
      .first();

    const fullMessage = { ...message, sender };

    // If student sent message to coach, trigger AI response generation
    if (authUser.userId === thread.student_id && thread.ai_mode !== 'off') {
      try {
        const { generateAIResponse } = await import('@/lib/ai-service');

        const recentMessages = await db('direct_messages')
          .where({ thread_id: threadId })
          .where(function () {
            this.where('is_pending', false).orWhereNull('is_pending');
          })
          .orderBy('created_at', 'desc')
          .limit(10);

        const history = recentMessages.reverse().map((m: any) => ({
          role: (m.sender_id === thread.student_id ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));

        // Before generating AI response, remove any existing pending suggestions
        await db('direct_messages')
          .where({ thread_id: threadId, is_pending: true })
          .del();

        const { response: aiResponse, confidence } = await generateAIResponse(content, history);

        if (thread.ai_mode === 'autopilot' && confidence >= 0.7) {
          // High confidence in autopilot mode: send immediately
          const [aiMsg] = await db('direct_messages')
            .insert({
              thread_id: threadId,
              sender_id: thread.coach_id,
              content: aiResponse,
              is_ai_generated: true,
              ai_confidence: confidence,
              is_pending: false,
              is_read: false,
            })
            .returning('*');

          // Update thread timestamp for the auto-sent message
          await db('direct_message_threads')
            .where({ id: threadId })
            .update({ last_message_at: db.fn.now() });
        } else {
          // Suggest mode, or autopilot with low confidence: save as pending
          await db('direct_messages')
            .insert({
              thread_id: threadId,
              sender_id: thread.coach_id,
              content: aiResponse,
              is_ai_generated: true,
              ai_confidence: confidence,
              is_pending: true,
              was_edited_before_send: false,
              is_read: false,
            });
        }
      } catch (aiErr) {
        console.error('AI response generation failed:', aiErr);
      }
    }

    return NextResponse.json({ message: fullMessage }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
