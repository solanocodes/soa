import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    await requireAuth(req);
    const { slug } = params;

    const channel = await db('channels')
      .where({ slug, is_active: true })
      .first();

    if (!channel) {
      return errorResponse('Channel not found', 404);
    }

    return NextResponse.json({ channel });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
