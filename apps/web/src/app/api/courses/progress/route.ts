import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const { course_id, module_id, lesson_id } = await req.json();

    if (!course_id || !module_id || !lesson_id) {
      return errorResponse('course_id, module_id, and lesson_id are required', 400);
    }

    // Upsert progress
    const existing = await db('course_progress')
      .where({ user_id: authUser.userId, course_id, module_id, lesson_id })
      .first();

    if (existing) {
      await db('course_progress')
        .where({ id: existing.id })
        .update({ completed_at: db.fn.now() });
    } else {
      await db('course_progress').insert({
        user_id: authUser.userId,
        course_id,
        module_id,
        lesson_id,
        completed_at: db.fn.now(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
