import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  tier: string;
  isAdmin: boolean;
  isCoach: boolean;
}

export function getAuthPayload(req: NextRequest): AuthPayload | null {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): AuthPayload {
  const payload = getAuthPayload(req);
  if (!payload) {
    throw new AuthError('No token provided or token invalid', 401);
  }
  return payload;
}

export function requireAdmin(req: NextRequest): AuthPayload {
  const payload = requireAuth(req);
  if (!payload.isAdmin) {
    throw new AuthError('Admin access required', 403);
  }
  return payload;
}

export function requireCoach(req: NextRequest): AuthPayload {
  const payload = requireAuth(req);
  if (!payload.isAdmin && !payload.isCoach) {
    throw new AuthError('Coach access required', 403);
  }
  return payload;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
