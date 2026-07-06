import { NextResponse } from 'next/server';
import db from '@/lib/database';
import { decodeDataUrl } from '@/lib/avatars';

// Serves the uploaded sidebar logo as a real image so the settings
// payload stays tiny and the browser can cache the logo.
// Without force-dynamic, Next statically evaluates this GET at build
// time (no DB available) and bakes in a permanent 404.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await db('app_settings').where({ key: 'logo_url' }).first();

    if (!row?.value) {
      return new NextResponse(null, { status: 404 });
    }

    if (row.value.startsWith('data:')) {
      const decoded = decodeDataUrl(row.value);
      if (!decoded) return new NextResponse(null, { status: 404 });
      return new NextResponse(new Uint8Array(decoded.buffer), {
        status: 200,
        headers: {
          'Content-Type': decoded.contentType,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    return NextResponse.redirect(row.value, 302);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
