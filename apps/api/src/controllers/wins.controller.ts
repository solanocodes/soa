import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import db from '../config/database';

export async function listWins(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { cursor, limit = 50 } = req.query;

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
      .limit(Math.min(Number(limit), 50));

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
      content: win.content,
      ticker: win.ticker,
      profit_amount: win.profit_amount,
      profit_percent: win.profit_percent,
      image_url: win.image_url,
      is_verified: win.is_verified,
      verified_at: win.verified_at,
      created_at: win.created_at,
      author: {
        id: win.user_id,
        username: win.author_username,
        display_name: win.author_display_name,
        avatar_url: win.author_avatar_url,
      },
    }));

    const nextCursor = wins.length > 0 ? wins[wins.length - 1].id : null;

    res.json({ wins: formattedWins, nextCursor });
  } catch (error) {
    next(error);
  }
}

export async function postWin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { content, ticker, profit_amount, profit_percent, image_url } = req.body;

    if (!content) {
      throw new AppError('content is required', 400);
    }

    const [win] = await db('student_wins')
      .insert({
        user_id: req.userId,
        content,
        ticker: ticker ? ticker.toUpperCase() : null,
        profit_amount: profit_amount || null,
        profit_percent: profit_percent || null,
        image_url: image_url || null,
        is_verified: false,
      })
      .returning('*');

    res.status(201).json({ win });
  } catch (error) {
    next(error);
  }
}

export async function verifyWin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const win = await db('student_wins').where({ id }).first();
    if (!win) {
      throw new AppError('Win not found', 404);
    }

    const [updatedWin] = await db('student_wins')
      .where({ id })
      .update({
        is_verified: true,
        verified_at: db.fn.now(),
      })
      .returning('*');

    res.json({ win: updatedWin });
  } catch (error) {
    next(error);
  }
}
