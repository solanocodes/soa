import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { decodeDataUrl } from '@/lib/avatars';

// Serves a user's avatar as a real image. No auth: <img> tags cannot
// send Authorization headers, and avatars are non-sensitive.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await db('users')
      .where({ id: params.id })
      .select('avatar_url')
      .first();

    if (!user?.avatar_url) {
      return new NextResponse(null, { status: 404 });
    }

    if (user.avatar_url.startsWith('data:')) {
      const decoded = decodeDataUrl(user.avatar_url);
      if (!decoded) return new NextResponse(null, { status: 404 });
      return new NextResponse(new Uint8Array(decoded.buffer), {
        status: 200,
        headers: {
          'Content-Type': decoded.contentType,
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
        },
      });
    }

    return NextResponse.redirect(user.avatar_url, 302);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
