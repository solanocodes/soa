import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

const TIER_HIERARCHY: Record<string, number> = {
  FREE: 0,
  MENTORSHIP: 1,
  SOA_CORE: 1,
  INNER_CIRCLE: 2,
  SOA_WEALTH: 3,
  BOT_PRODUCT: 3,
};

function hasAccess(userTier: string, requiredTier: string): boolean {
  return (TIER_HIERARCHY[userTier] ?? 0) >= (TIER_HIERARCHY[requiredTier] ?? 0);
}

// Channel names come from the database. If you update channel names in the
// seed file (001_channels_and_admin.js), you need to re-run the seed or run
// migration 012_update_channels.js to update existing records.
export async function GET(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const userTier = (authUser.tier || 'FREE') as string;

    const channels = await db('channels')
      .where({ is_active: true })
      .orderBy('position', 'asc');

    // Admins see all channels regardless of tier
    const accessibleChannels = authUser.isAdmin
      ? channels
      : channels.filter((channel) =>
          hasAccess(userTier, channel.required_tier as string)
        );

    return NextResponse.json({ channels: accessibleChannels });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
