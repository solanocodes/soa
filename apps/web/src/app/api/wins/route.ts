import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

// Returns ALL wins (including historical imports) by default.
// If the wins page shows empty, the historical data likely hasn't been
// imported into the Railway database yet — the import scripts need to be
// run against the production DB, or the data files need to be uploaded.
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    let query = db('student_wins')
      .leftJoin('users', 'student_wins.user_id', 'users.id')
      .select(
        'student_wins.*',
        'users.username as author_username',
        'users.display_name as author_display_name',
        'users.avatar_url as author_avatar_url'
      )
      .orderBy([
        { column: 'student_wins.created_at', order: 'desc' },
        { column: 'student_wins.id', order: 'desc' },
      ])
      .limit(limit);

    if (cursor) {
      const cursorWin = await db('student_wins').where({ id: cursor }).first();
      if (cursorWin) {
        query = query.where(function () {
          this.where('student_wins.created_at', '<', cursorWin.created_at)
            .orWhere(function () {
              this.where('student_wins.created_at', '=', cursorWin.created_at)
                .andWhere('student_wins.id', '<', cursorWin.id);
            });
        });
      }
    }

    const wins = await query;

    const formattedWins = wins.map((win) => ({
      id: win.id,
      user_id: win.user_id,
      caption: win.caption,
      screenshot_url: win.screenshot_url,
      win_type: win.win_type,
      pnl_amount: win.pnl_amount,
      is_verified: win.is_verified,
      is_featured: win.is_featured,
      is_historical: win.is_historical,
      original_author_name: win.original_author_name,
      original_discord_id: win.original_discord_id,
      created_at: win.created_at,
      author: win.user_id ? {
        id: win.user_id,
        username: win.author_username,
        display_name: win.author_display_name,
        avatar_url: win.author_avatar_url,
      } : null,
    }));

    const nextCursor = wins.length > 0 ? wins[wins.length - 1].id : null;

    return NextResponse.json({ wins: formattedWins, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const { content, ticker, profit_amount, profit_percent, image_url } = await req.json();

    if (!content) {
      return errorResponse('content is required', 400);
    }

    const [win] = await db('student_wins')
      .insert({
        user_id: authUser.userId,
        content,
        ticker: ticker ? ticker.toUpperCase() : null,
        profit_amount: profit_amount || null,
        profit_percent: profit_percent || null,
        image_url: image_url || null,
        is_verified: false,
      })
      .returning('*');

    return NextResponse.json({ win }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
