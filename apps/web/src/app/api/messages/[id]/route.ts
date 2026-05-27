import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;

    const message = await db('messages').where({ id }).first();
    if (!message) return errorResponse('Message not found', 404);

    // Only author or admin can delete
    if (message.user_id !== authUser.userId && !authUser.isAdmin) {
      return errorResponse('Not authorized', 403);
    }

    await db('messages').where({ id }).update({ is_deleted: true });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
