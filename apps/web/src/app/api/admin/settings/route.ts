import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuthFresh as requireAuth, errorResponse } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const rows = await db('app_settings').select('key', 'value');
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ settings: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const { logo_url, app_name, app_subtitle } = await req.json();

    if (logo_url !== undefined) {
      await db('app_settings').where({ key: 'logo_url' }).update({ value: logo_url, updated_at: db.fn.now() });
    }
    if (app_name !== undefined) {
      await db('app_settings').where({ key: 'app_name' }).update({ value: app_name, updated_at: db.fn.now() });
    }
    if (app_subtitle !== undefined) {
      await db('app_settings').where({ key: 'app_subtitle' }).update({ value: app_subtitle, updated_at: db.fn.now() });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return errorResponse(err.message, err.status || 500);
  }
}
