import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);

    // Only admins/coaches can verify wins
    if (!authUser.isAdmin && !authUser.isCoach) {
      return errorResponse('Coach access required', 403);
    }

    const { id } = params;

    const win = await db('student_wins').where({ id }).first();
    if (!win) {
      return errorResponse('Win not found', 404);
    }

    const [updatedWin] = await db('student_wins')
      .where({ id })
      .update({
        is_verified: true,
        verified_at: db.fn.now(),
      })
      .returning('*');

    return NextResponse.json({ win: updatedWin });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
