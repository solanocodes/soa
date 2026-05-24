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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = params;
    const userTier = (authUser.tier || 'FREE') as Tier;

    const course = await db('courses').where({ id }).first();
    if (!course) {
      return errorResponse('Course not found', 404);
    }

    if (!hasAccess(userTier, course.required_tier as Tier)) {
      return errorResponse('Insufficient tier access', 403);
    }

    const modules = await db('course_modules')
      .where({ course_id: id })
      .orderBy('position', 'asc');

    return NextResponse.json({ modules });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
