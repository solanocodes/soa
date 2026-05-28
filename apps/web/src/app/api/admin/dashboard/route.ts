import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);

    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const totalStudents = await db('users').count('id as count').first();

    const studentsByTier = await db('users')
      .select('tier')
      .count('id as count')
      .groupBy('tier');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const inactive7Days = await db('users')
      .where('last_active_at', '<', sevenDaysAgo.toISOString())
      .count('id as count')
      .first();

    const newThisWeek = await db('users')
      .where('created_at', '>=', sevenDaysAgo.toISOString())
      .count('id as count')
      .first();

    return NextResponse.json({
      total_students: Number(totalStudents?.count || 0),
      students_by_tier: studentsByTier.reduce((acc, row) => {
        acc[row.tier] = Number(row.count);
        return acc;
      }, {} as Record<string, number>),
      inactive_7_days: Number(inactive7Days?.count || 0),
      new_this_week: Number(newThisWeek?.count || 0),
    });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
