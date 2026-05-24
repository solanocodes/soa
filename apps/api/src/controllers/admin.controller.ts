import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import db from '../config/database';

export async function dashboard(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
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

    res.json({
      total_students: Number(totalStudents?.count || 0),
      students_by_tier: studentsByTier.reduce((acc, row) => {
        acc[row.tier] = Number(row.count);
        return acc;
      }, {} as Record<string, number>),
      inactive_7_days: Number(inactive7Days?.count || 0),
      new_this_week: Number(newThisWeek?.count || 0),
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { search, tier, cursor, limit = 50 } = req.query;

    let query = db('users')
      .select(
        'id', 'email', 'username', 'display_name', 'avatar_url',
        'tier', 'tier_expires_at', 'is_admin', 'is_coach',
        'onboarding_day', 'onboarding_completed', 'last_active_at', 'created_at'
      )
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .limit(Math.min(Number(limit), 50));

    if (search) {
      const searchStr = `%${search}%`;
      query = query.where(function () {
        this.whereILike('username', searchStr)
          .orWhereILike('email', searchStr)
          .orWhereILike('display_name', searchStr);
      });
    }

    if (tier) {
      query = query.where('tier', tier);
    }

    if (cursor) {
      const cursorUser = await db('users').where({ id: cursor }).first();
      if (cursorUser) {
        query = query.where(function () {
          this.where('created_at', '<', cursorUser.created_at)
            .orWhere(function () {
              this.where('created_at', '=', cursorUser.created_at)
                .andWhere('id', '<', cursorUser.id);
            });
        });
      }
    }

    const users = await query;
    const nextCursor = users.length > 0 ? users[users.length - 1].id : null;

    res.json({ users, nextCursor });
  } catch (error) {
    next(error);
  }
}

export async function updateTier(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { tier, tier_expires_at } = req.body;

    if (!tier) {
      throw new AppError('tier is required', 400);
    }

    const validTiers = ['FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT'];
    if (!validTiers.includes(tier)) {
      throw new AppError('Invalid tier value', 400);
    }

    const user = await db('users').where({ id }).first();
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const [updatedUser] = await db('users')
      .where({ id })
      .update({
        tier,
        tier_expires_at: tier_expires_at || null,
      })
      .returning([
        'id', 'email', 'username', 'display_name', 'tier',
        'tier_expires_at', 'is_admin', 'is_coach',
      ]);

    res.json({ user: updatedUser });
  } catch (error) {
    next(error);
  }
}
