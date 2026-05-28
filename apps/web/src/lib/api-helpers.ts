import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import db from './database';

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.substring(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      tier: string;
      isAdmin: boolean;
      isCoach: boolean;
    };
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest) {
  const tokenUser = await getAuthUser(req);
  if (!tokenUser) throw new AuthError('Unauthorized', 401);

  const dbUser = await db('users')
    .where({ id: tokenUser.userId })
    .select('id', 'tier', 'is_admin', 'is_coach')
    .first();

  if (!dbUser) throw new AuthError('User not found', 401);

  return {
    userId: dbUser.id,
    tier: dbUser.tier,
    isAdmin: dbUser.is_admin,
    isCoach: dbUser.is_coach,
  };
}

export const requireAuthFresh = requireAuth;

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export { db };
