import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const { image_urls } = await req.json();
    if (!image_urls || !Array.isArray(image_urls)) {
      return errorResponse('image_urls array required', 400);
    }

    let imported = 0;
    for (const url of image_urls) {
      try {
        await db('student_wins').insert({
          user_id: null,
          caption: null,
          screenshot_url: url,
          win_type: 'trade_win',
          pnl_amount: null,
          is_verified: true,
          is_featured: false,
          reaction_count: 0,
          is_historical: true,
          original_author_name: 'SOA Student',
          original_discord_id: null,
          original_timestamp: new Date(),
          created_at: new Date(),
        });
        imported++;
      } catch {
        // skip
      }
    }

    return NextResponse.json({ imported });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
