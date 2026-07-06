import db from './database';

// Avatars are stored as base64 data URLs (up to ~4MB each). Joining
// users.avatar_url into message/alert/win lists made every response
// carry megabytes per row, which is what hung channel loading for
// members on slower connections. These helpers swap the inline data
// URL for a small per-user endpoint URL that the browser can cache.

// SQL select fragment for queries that join the users table.
export function avatarUrlSelect(alias: string) {
  return db.raw(
    "case when users.avatar_url like 'data:%' then '/api/users/' || users.id || '/avatar' else users.avatar_url end as ??",
    [alias]
  );
}

// For single rows already fetched from the DB.
export function publicAvatarUrl(userId: string | null | undefined, avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  if (avatarUrl.startsWith('data:')) return `/api/users/${userId}/avatar`;
  return avatarUrl;
}

// Decode a stored data URL into binary for serving as a real image.
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  const header = dataUrl.slice(0, comma);
  const data = dataUrl.slice(comma + 1);
  const contentType = header.slice(5).split(';')[0] || 'image/png';
  const isBase64 = header.includes(';base64');
  const buffer = isBase64
    ? Buffer.from(data, 'base64')
    : Buffer.from(decodeURIComponent(data), 'utf8');
  return { buffer, contentType };
}
