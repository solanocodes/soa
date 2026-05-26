import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const { avatar_url } = await req.json();

    if (!avatar_url) {
      return errorResponse('avatar_url is required', 400);
    }

    await db('users')
      .where({ id: authUser.userId })
      .update({ avatar_url });

    return NextResponse.json({ avatar_url });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
