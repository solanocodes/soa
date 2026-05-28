import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    // Soft-delete any messages with embedded data URL images
    // These cause huge response payloads and slow loading
    const result = await db('messages')
      .where('content', 'like', '%data:image%')
      .update({ is_deleted: true });

    return NextResponse.json({ deleted: result });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
