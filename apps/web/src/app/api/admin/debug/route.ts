import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const alertCount = await db('alerts').count('id as count').first();
    const winCount = await db('student_wins').count('id as count').first();
    const userCount = await db('users').count('id as count').first();
    const channelCount = await db('channels').count('id as count').first();

    const sampleAlert = await db('alerts').orderBy('created_at', 'desc').first();
    const sampleWin = await db('student_wins').orderBy('created_at', 'desc').first();

    return NextResponse.json({
      counts: {
        alerts: Number(alertCount?.count || 0),
        wins: Number(winCount?.count || 0),
        users: Number(userCount?.count || 0),
        channels: Number(channelCount?.count || 0),
      },
      sampleAlert,
      sampleWin,
    });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
