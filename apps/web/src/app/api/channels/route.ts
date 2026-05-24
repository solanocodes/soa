import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

const TIERS = ['FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT'] as const;
type Tier = (typeof TIERS)[number];

const TIER_HIERARCHY: Record<Tier, number> = {
  FREE: 0,
  SOA_CORE: 1,
  SOA_WEALTH: 2,
  BOT_PRODUCT: 3,
};

function hasAccess(userTier: Tier, requiredTier: Tier): boolean {
  return TIER_HIERARCHY[userTier] >= TIER_HIERARCHY[requiredTier];
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const userTier = (authUser.tier || 'FREE') as Tier;

    const channels = await db('channels')
      .where({ is_active: true })
      .orderBy('position', 'asc');

    const accessibleChannels = channels.filter((channel) =>
      hasAccess(userTier, channel.required_tier as Tier)
    );

    return NextResponse.json({ channels: accessibleChannels });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
