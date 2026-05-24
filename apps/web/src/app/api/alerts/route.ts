import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);

    const channel_slug = req.nextUrl.searchParams.get('channel_slug');
    const alert_type = req.nextUrl.searchParams.get('alert_type');
    const ticker = req.nextUrl.searchParams.get('ticker');
    const cursor = req.nextUrl.searchParams.get('cursor');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 50);

    let query = db('alerts')
      .leftJoin('users', 'alerts.author_id', 'users.id')
      .select(
        'alerts.*',
        'users.username as author_username',
        'users.display_name as author_display_name',
        'users.avatar_url as author_avatar_url'
      )
      .orderBy([
        { column: 'alerts.created_at', order: 'desc' },
        { column: 'alerts.id', order: 'desc' },
      ])
      .limit(limit);

    if (channel_slug) {
      query = query.where('alerts.channel_slug', channel_slug);
    }

    if (alert_type) {
      query = query.where('alerts.alert_type', alert_type);
    }

    if (ticker) {
      query = query.where('alerts.ticker', ticker.toUpperCase());
    }

    if (cursor) {
      const cursorAlert = await db('alerts').where({ id: cursor }).first();
      if (cursorAlert) {
        query = query.where(function () {
          this.where('alerts.created_at', '<', cursorAlert.created_at)
            .orWhere(function () {
              this.where('alerts.created_at', '=', cursorAlert.created_at)
                .andWhere('alerts.id', '<', cursorAlert.id);
            });
        });
      }
    }

    const alerts = await query;

    const formattedAlerts = alerts.map((alert) => ({
      id: alert.id,
      author_id: alert.author_id,
      content: alert.content,
      ticker: alert.ticker,
      direction: alert.direction,
      entry_price: alert.entry_price,
      target_price: alert.target_price,
      stop_price: alert.stop_price,
      result_ticks: alert.result_ticks,
      alert_type: alert.alert_type,
      channel_slug: alert.channel_slug,
      has_image: alert.has_image,
      image_url: alert.image_url,
      is_historical: alert.is_historical,
      created_at: alert.created_at,
      author: {
        id: alert.author_id,
        username: alert.author_username,
        display_name: alert.author_display_name,
        avatar_url: alert.author_avatar_url,
      },
    }));

    const nextCursor = alerts.length > 0 ? alerts[alerts.length - 1].id : null;

    return NextResponse.json({ alerts: formattedAlerts, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const {
      content, ticker, direction, entry_price, target_price,
      stop_price, alert_type, channel_slug, image_url,
    } = await req.json();

    if (!content || !alert_type || !channel_slug) {
      return errorResponse('content, alert_type, and channel_slug are required', 400);
    }

    const [alert] = await db('alerts')
      .insert({
        author_id: authUser.userId,
        content,
        ticker: ticker ? ticker.toUpperCase() : null,
        direction: direction || null,
        entry_price: entry_price || null,
        target_price: target_price || null,
        stop_price: stop_price || null,
        alert_type,
        channel_slug,
        has_image: !!image_url,
        image_url: image_url || null,
        is_historical: false,
      })
      .returning('*');

    // Get author info
    const author = await db('users')
      .where({ id: authUser.userId })
      .select('id', 'username', 'display_name', 'avatar_url')
      .first();

    const fullAlert = { ...alert, author };

    return NextResponse.json({ alert: fullAlert }, { status: 201 });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
