import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  display_name: string;
  tier: string;
  is_admin: boolean;
  is_coach: boolean;
  avatar_url: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string };

    const result = await query(
      'SELECT id, email, username, display_name, tier, is_admin, is_coach, avatar_url FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = result.rows[0];

    // Update last active
    await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [decoded.userId]);

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export function requireCoach(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user?.is_admin && !req.user?.is_coach) {
    res.status(403).json({ error: 'Coach access required' });
    return;
  }
  next();
}
