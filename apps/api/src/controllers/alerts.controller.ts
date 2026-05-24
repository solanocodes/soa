import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import db from '../config/database';

export async function listAlerts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { channel_slug, alert_type, ticker, cursor, limit = 50 } = req.query;

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
      .limit(Math.min(Number(limit), 50));

    if (channel_slug) {
      query = query.where('alerts.channel_slug', channel_slug);
    }

    if (alert_type) {
      query = query.where('alerts.alert_type', alert_type);
    }

    if (ticker) {
      query = query.where('alerts.ticker', (ticker as string).toUpperCase());
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

    res.json({ alerts: formattedAlerts, nextCursor });
  } catch (error) {
    next(error);
  }
}

export async function createAlert(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const {
      content, ticker, direction, entry_price, target_price,
      stop_price, alert_type, channel_slug, image_url,
    } = req.body;

    if (!content || !alert_type || !channel_slug) {
      throw new AppError('content, alert_type, and channel_slug are required', 400);
    }

    const [alert] = await db('alerts')
      .insert({
        author_id: req.userId,
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
      .where({ id: req.userId })
      .select('id', 'username', 'display_name', 'avatar_url')
      .first();

    const fullAlert = { ...alert, author };

    // Broadcast new alert
    const io = req.app.get('io');
    io.emit('new_alert', fullAlert);

    res.status(201).json({ alert: fullAlert });
  } catch (error) {
    next(error);
  }
}
