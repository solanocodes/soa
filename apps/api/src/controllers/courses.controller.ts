import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { hasAccess, Tier } from '@soa/shared';
import db from '../config/database';

export async function listCourses(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userTier = (req.userTier || 'FREE') as Tier;

    const courses = await db('courses').orderBy('position', 'asc');

    const accessibleCourses = courses.filter((course) =>
      hasAccess(userTier, course.required_tier as Tier)
    );

    res.json({ courses: accessibleCourses });
  } catch (error) {
    next(error);
  }
}

export async function getModules(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const userTier = (req.userTier || 'FREE') as Tier;

    const course = await db('courses').where({ id }).first();
    if (!course) {
      throw new AppError('Course not found', 404);
    }

    if (!hasAccess(userTier, course.required_tier as Tier)) {
      throw new AppError('Insufficient tier access', 403);
    }

    const modules = await db('course_modules')
      .where({ course_id: id })
      .orderBy('position', 'asc');

    res.json({ modules });
  } catch (error) {
    next(error);
  }
}

export async function markProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { course_id, module_id, lesson_id } = req.body;

    if (!course_id || !module_id || !lesson_id) {
      throw new AppError('course_id, module_id, and lesson_id are required', 400);
    }

    // Upsert progress
    const existing = await db('course_progress')
      .where({ user_id: req.userId, course_id, module_id, lesson_id })
      .first();

    if (existing) {
      await db('course_progress')
        .where({ id: existing.id })
        .update({ completed_at: db.fn.now() });
    } else {
      await db('course_progress').insert({
        user_id: req.userId,
        course_id,
        module_id,
        lesson_id,
        completed_at: db.fn.now(),
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}
