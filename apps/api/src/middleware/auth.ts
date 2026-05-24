import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  userId?: string;
  userTier?: string;
  isAdmin?: boolean;
  isCoach?: boolean;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401));
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      tier: string;
      isAdmin: boolean;
      isCoach: boolean;
    };
    req.userId = payload.userId;
    req.userTier = payload.tier;
    req.isAdmin = payload.isAdmin;
    req.isCoach = payload.isCoach;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.isAdmin) {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

export function requireCoach(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.isAdmin && !req.isCoach) {
    return next(new AppError('Coach access required', 403));
  }
  next();
}
