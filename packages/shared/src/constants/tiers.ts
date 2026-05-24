export const TIERS = ['FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT'] as const;
export type Tier = (typeof TIERS)[number];

export const TIER_HIERARCHY: Record<Tier, number> = {
  FREE: 0,
  SOA_CORE: 1,
  SOA_WEALTH: 2,
  BOT_PRODUCT: 3,
};

export function hasAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export const TIER_LABELS: Record<Tier, string> = {
  FREE: 'Free',
  SOA_CORE: 'SOA Core',
  SOA_WEALTH: 'SOA Wealth',
  BOT_PRODUCT: 'Bot Product',
};

export const TIER_COLORS: Record<Tier, string> = {
  FREE: '#888888',
  SOA_CORE: '#00D084',
  SOA_WEALTH: '#C9A84C',
  BOT_PRODUCT: '#4488FF',
};
