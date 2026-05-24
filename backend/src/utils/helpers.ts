import { v4 as uuidv4 } from 'uuid';

export const tierHierarchy: Record<string, number> = {
  FREE: 0,
  SOA_CORE: 1,
  SOA_WEALTH: 2,
  BOT_PRODUCT: 3,
};

export function tierMeetsRequirement(userTier: string, requiredTier: string): boolean {
  const userLevel = tierHierarchy[userTier] ?? 0;
  const requiredLevel = tierHierarchy[requiredTier] ?? 0;
  return userLevel >= requiredLevel;
}

export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SOA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = eastern.getDay();
  const hours = eastern.getHours();
  const minutes = eastern.getMinutes();
  const timeInMinutes = hours * 60 + minutes;

  // Market hours: Mon-Fri 9:30 AM - 4:00 PM ET
  if (day === 0 || day === 6) return false;
  if (timeInMinutes < 570 || timeInMinutes >= 960) return false; // 9:30=570, 16:00=960
  return true;
}

export function generateId(): string {
  return uuidv4();
}

export function paginationParams(query: { page?: string; limit?: string }): { offset: number; limit: number; page: number } {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '50', 10)));
  const offset = (page - 1) * limit;
  return { offset, limit, page };
}
