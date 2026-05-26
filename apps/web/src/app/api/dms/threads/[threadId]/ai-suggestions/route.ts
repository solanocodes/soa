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

    // Verify thread exists and user is the coach
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      return errorResponse('Thread not found', 404);
    }

    // Only the coach/admin can see AI suggestions
    if (thread.coach_id !== authUser.userId) {
      return errorResponse('Not authorized', 403);
    }

    const suggestions = await db('direct_messages')
      .where({
        thread_id: threadId,
        is_ai_generated: true,
        is_pending: true,
      })
      .orderBy('created_at', 'desc')
      .select('*');

    return NextResponse.json({ suggestions });
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
    const { action, suggestion_id, content } = await req.json();

    if (!action || !suggestion_id) {
      return errorResponse('action and suggestion_id are required', 400);
    }

    // Verify thread exists and user is the coach
    const thread = await db('direct_message_threads').where({ id: threadId }).first();
    if (!thread) {
      return errorResponse('Thread not found', 404);
    }

    if (thread.coach_id !== authUser.userId) {
      return errorResponse('Not authorized', 403);
    }

    // Verify suggestion exists and is pending
    const suggestion = await db('direct_messages')
      .where({
        id: suggestion_id,
        thread_id: threadId,
        is_ai_generated: true,
        is_pending: true,
      })
      .first();

    if (!suggestion) {
      return errorResponse('Suggestion not found or already processed', 404);
    }

    switch (action) {
      case 'approve': {
        // Approve and send the AI message as-is
        const [updated] = await db('direct_messages')
          .where({ id: suggestion_id })
          .update({
            is_pending: false,
            was_edited_before_send: false,
          })
          .returning('*');

        // Update thread last_message_at
        await db('direct_message_threads')
          .where({ id: threadId })
          .update({ last_message_at: db.fn.now() });

        return NextResponse.json({ message: updated });
      }

      case 'edit': {
        if (!content) {
          return errorResponse('content is required for edit action', 400);
        }

        // Update the content and send
        const [updated] = await db('direct_messages')
          .where({ id: suggestion_id })
          .update({
            content,
            is_pending: false,
            was_edited_before_send: true,
          })
          .returning('*');

        // Update thread last_message_at
        await db('direct_message_threads')
          .where({ id: threadId })
          .update({ last_message_at: db.fn.now() });

        return NextResponse.json({ message: updated });
      }

      case 'reject': {
        // Delete the suggestion
        await db('direct_messages').where({ id: suggestion_id }).delete();
        return NextResponse.json({ success: true });
      }

      default:
        return errorResponse('Invalid action. Must be approve, edit, or reject', 400);
    }
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
