import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuthFresh, errorResponse } from '@/lib/api-helpers';
import { runDailyRecap } from '@/lib/daily-recap';
import { isValidDateString, marketDate, MARKET_TZ } from '@/lib/market-day';

export const dynamic = 'force-dynamic';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// The scheduler authenticates with a shared secret; a human authenticates with
// their normal admin JWT. Both arrive as `Authorization: Bearer …`.
function hasCronSecret(req: NextRequest): boolean {
  const secret = process.env.RECAP_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.substring(7) : '';
  if (!token) return false;

  return timingSafeEqual(token, secret);
}

async function authorize(req: NextRequest): Promise<void> {
  if (hasCronSecret(req)) return;

  const authUser = await requireAuthFresh(req);
  if (!authUser.isAdmin && !authUser.isCoach) {
    const err: any = new Error('Admin access required');
    err.status = 403;
    throw err;
  }
}

function resolveDate(req: NextRequest): string {
  const raw = req.nextUrl.searchParams.get('date');
  if (!raw) return marketDate(new Date(), MARKET_TZ);
  if (!isValidDateString(raw)) {
    const err: any = new Error('date must be YYYY-MM-DD');
    err.status = 400;
    throw err;
  }
  return raw;
}

// Preview what today's (or ?date=YYYY-MM-DD's) recap would look like,
// without posting anything to Discord.
export async function GET(req: NextRequest) {
  try {
    await authorize(req);
    const result = await runDailyRecap({ date: resolveDate(req), dryRun: true });
    return NextResponse.json(result);
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}

// Build and post the recap. Called by the scheduler after the close, and
// available for a manual re-post with ?force=true.
export async function POST(req: NextRequest) {
  try {
    await authorize(req);

    const params = req.nextUrl.searchParams;
    const result = await runDailyRecap({
      date: resolveDate(req),
      force: params.get('force') === 'true',
      dryRun: params.get('dry_run') === 'true',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
