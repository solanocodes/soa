import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    // Only coaches and admins can search users for DMs
    if (!authUser.isAdmin && !authUser.isCoach) {
      return errorResponse('Not authorized', 403);
    }

    const query = req.nextUrl.searchParams.get('q');
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    const searchTerm = `%${query.trim().toLowerCase()}%`;

    const users = await db('users')
      .whereRaw('LOWER(username) LIKE ?', [searchTerm])
      .orWhereRaw('LOWER(display_name) LIKE ?', [searchTerm])
      .orWhereRaw('LOWER(email) LIKE ?', [searchTerm])
      .select('id', 'username', 'display_name', 'avatar_url')
      .limit(20);

    // Filter out the current user from results
    const filtered = users.filter((u: any) => u.id !== authUser.userId);

    return NextResponse.json({ users: filtered });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
