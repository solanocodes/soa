import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  tier: string;
  isAdmin: boolean;
  isCoach: boolean;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '30d' });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '90d' });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as TokenPayload;
}
