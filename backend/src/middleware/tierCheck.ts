import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { tierMeetsRequirement } from '../utils/helpers';

export function tierCheck(requiredTier: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Admins and coaches bypass tier checks
    if (req.user.is_admin || req.user.is_coach) {
      next();
      return;
    }

    if (!tierMeetsRequirement(req.user.tier, requiredTier)) {
      res.status(403).json({
        error: 'Insufficient tier',
        required_tier: requiredTier,
        current_tier: req.user.tier,
        message: `This feature requires ${requiredTier} tier or higher.`
      });
      return;
    }

    next();
  };
}
