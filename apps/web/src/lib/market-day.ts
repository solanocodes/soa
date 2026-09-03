// Helpers for working with "trading days" in market time.
//
// Everything about a recap is anchored to the exchange's calendar day
// (America/New_York by default), while `alerts.created_at` and friends are
// plain `TIMESTAMP` columns written with the database's `NOW()` — i.e. UTC on
// Railway. So we translate a market day into an explicit UTC instant range and
// hand the boundaries to Postgres as formatted UTC strings, which sidesteps
// node-pg serializing JS Dates in the Node process's local time.

export const MARKET_TZ = process.env.DAILY_RECAP_TZ || 'America/New_York';

type Parts = {
  year: number; month: number; day: number;
  hour: number; minute: number; second: number;
};

function zonedParts(instant: Date, timeZone: string): Parts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts: Record<string, string> = {};
  for (const { type, value } of formatter.formatToParts(instant)) {
    parts[type] = value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

// How far the zone is ahead of UTC at a given instant, in milliseconds.
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instant.getTime();
}

// The calendar date (YYYY-MM-DD) an instant falls on, in market time.
export function marketDate(instant: Date = new Date(), timeZone: string = MARKET_TZ): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function shiftDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return marketDate(shifted, 'UTC');
}

// The UTC instant at which the given market day starts.
function startOfMarketDay(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wallClockAsUtc = Date.UTC(y, m - 1, d);

  // Two passes: the first offset is read at the wrong instant on DST
  // boundaries, the second is read at (very nearly) the right one.
  let utcMs = wallClockAsUtc - zoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  utcMs = wallClockAsUtc - zoneOffsetMs(new Date(utcMs), timeZone);
  return new Date(utcMs);
}

// Half-open [start, end) UTC range covering one market day.
export function marketDayRange(dateStr: string, timeZone: string = MARKET_TZ): { start: Date; end: Date } {
  return {
    start: startOfMarketDay(dateStr, timeZone),
    end: startOfMarketDay(shiftDateString(dateStr, 1), timeZone),
  };
}

// 'YYYY-MM-DD HH:MM:SS' in UTC — the literal form Postgres compares against a
// `timestamp without time zone` column with no timezone guesswork.
export function toSqlTimestamp(instant: Date): string {
  return instant.toISOString().slice(0, 19).replace('T', ' ');
}

// Saturday/Sunday in market time. Market holidays aren't hardcoded — a holiday
// simply produces no activity, and a recap with no activity is skipped.
export function isWeekend(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 || dow === 6;
}

// "Wednesday, September 3, 2026"
export function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// "9:41 AM ET" style stamp for an instant, in market time.
export function formatMarketTime(instant: Date, timeZone: string = MARKET_TZ): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}
