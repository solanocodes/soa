import { Response, NextFunction } from 'express';
import { hasAccess, Tier } from '@soa/shared';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';

export function requireTier(requiredTier: Tier) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const userTier = (req.userTier || 'FREE') as Tier;
    if (!hasAccess(userTier, requiredTier)) {
      return next(new AppError(`Requires ${requiredTier} tier or higher`, 403));
    }
    next();
  };
}
