import db from './database';
import {
  DiscordEmbedField,
  DiscordWebhookPayload,
  DISCORD_LIMITS,
  postToDiscordWebhook,
  truncate,
} from './discord';
import {
  MARKET_TZ,
  formatLongDate,
  formatMarketTime,
  isWeekend,
  marketDate,
  marketDayRange,
  toSqlTimestamp,
} from './market-day';

const GREEN = 0x22c55e;
const RED = 0xef4444;
const NEUTRAL = 0x6366f1;

// How many individual trades to spell out before collapsing into a count.
const MAX_TRADE_LINES = 12;

export type RecapAlert = {
  id: string;
  content: string;
  ticker: string | null;
  direction: string | null;
  entry_price: string | null;
  target_price: string | null;
  stop_price: string | null;
  result_ticks: number | null;
  alert_type: string;
  channel_slug: string | null;
  created_at: Date;
};

export type RecapStats = {
  date: string;
  timeZone: string;
  counts: Record<string, number>;
  totalAlerts: number;
  tickers: string[];
  netTicks: number | null;
  targetsHit: number;
  stopsHit: number;
  winRate: number | null;
  firstAlertAt: Date | null;
  lastAlertAt: Date | null;
  tradeLines: string[];
  extraTrades: number;
  wins: { count: number; totalPnl: number | null };
  hasActivity: boolean;
};

export type RecapResult = {
  status: 'posted' | 'skipped' | 'already_posted' | 'preview';
  date: string;
  reason?: string;
  stats: RecapStats;
  payload: DiscordWebhookPayload | null;
};

function num(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: string | number | null | undefined): string | null {
  const parsed = num(value);
  if (parsed === null) return null;
  return parsed.toFixed(2).replace(/\.00$/, '');
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

// One line per trade alert: "9:41 AM · SPY LONG 5.20 → 7.00 (+18 ticks)"
function tradeLine(alert: RecapAlert, timeZone: string): string {
  const parts: string[] = [`\`${formatMarketTime(alert.created_at, timeZone)}\``];

  const symbol = alert.ticker ? `**${alert.ticker}**` : '**—**';
  const direction = alert.direction ? ` ${alert.direction.toUpperCase()}` : '';
  parts.push(`${symbol}${direction}`);

  const entry = money(alert.entry_price);
  const target = money(alert.target_price);
  if (entry && target) parts.push(`${entry} → ${target}`);
  else if (entry) parts.push(`@ ${entry}`);

  const ticks = alert.result_ticks;
  if (ticks !== null && ticks !== undefined) {
    parts.push(`(${signed(ticks)} ticks)`);
  } else if (alert.alert_type === 'target') {
    parts.push('✅ target');
  } else if (alert.alert_type === 'stop') {
    parts.push('🛑 stopped');
  }

  return truncate(parts.join(' '), 180);
}

export async function collectRecapStats(
  date: string,
  timeZone: string = MARKET_TZ
): Promise<RecapStats> {
  const { start, end } = marketDayRange(date, timeZone);
  const startSql = toSqlTimestamp(start);
  const endSql = toSqlTimestamp(end);

  // Historical rows are Discord backfills: their created_at is the import
  // time, so including them would dump an entire archive into one recap.
  const alerts: RecapAlert[] = await db('alerts')
    .where('created_at', '>=', startSql)
    .andWhere('created_at', '<', endSql)
    .andWhere(function () {
      this.where('is_historical', false).orWhereNull('is_historical');
    })
    .orderBy('created_at', 'asc')
    .select(
      'id', 'content', 'ticker', 'direction', 'entry_price', 'target_price',
      'stop_price', 'result_ticks', 'alert_type', 'channel_slug', 'created_at'
    );

  const winsRow = await db('student_wins')
    .where('created_at', '>=', startSql)
    .andWhere('created_at', '<', endSql)
    .andWhere(function () {
      this.where('is_historical', false).orWhereNull('is_historical');
    })
    .count('id as count')
    .sum('pnl_amount as pnl')
    .first();

  const counts: Record<string, number> = {};
  for (const alert of alerts) {
    counts[alert.alert_type] = (counts[alert.alert_type] || 0) + 1;
  }

  const tickers = Array.from(
    new Set(alerts.map((a) => a.ticker).filter((t): t is string => !!t))
  );

  const withTicks = alerts.filter((a) => a.result_ticks !== null && a.result_ticks !== undefined);
  const netTicks = withTicks.length
    ? withTicks.reduce((sum, a) => sum + Number(a.result_ticks), 0)
    : null;

  const targetsHit = counts.target || 0;
  const stopsHit = counts.stop || 0;
  const decided = targetsHit + stopsHit;
  const winRate = decided > 0 ? Math.round((targetsHit / decided) * 100) : null;

  // "Trades" for the log are the entries and their exits, not commentary.
  const logged = alerts.filter((a) => ['trade', 'trim', 'target', 'stop'].includes(a.alert_type));
  const tradeLines = logged.slice(0, MAX_TRADE_LINES).map((a) => tradeLine(a, timeZone));

  const winCount = Number(winsRow?.count || 0);
  const winPnl = num(winsRow?.pnl as any);

  return {
    date,
    timeZone,
    counts,
    totalAlerts: alerts.length,
    tickers,
    netTicks,
    targetsHit,
    stopsHit,
    winRate,
    firstAlertAt: alerts.length ? alerts[0].created_at : null,
    lastAlertAt: alerts.length ? alerts[alerts.length - 1].created_at : null,
    tradeLines,
    extraTrades: Math.max(0, logged.length - tradeLines.length),
    wins: { count: winCount, totalPnl: winPnl },
    hasActivity: alerts.length > 0 || winCount > 0,
  };
}

async function brandName(): Promise<string> {
  try {
    const row = await db('app_settings').where({ key: 'app_name' }).first();
    return row?.value || 'Simply Options Academy';
  } catch {
    return 'Simply Options Academy';
  }
}

export function buildRecapPayload(stats: RecapStats, appName = 'Simply Options Academy'): DiscordWebhookPayload {
  const fields: DiscordEmbedField[] = [];

  const entries = stats.counts.trade || 0;
  fields.push({ name: 'Trades Called', value: String(entries), inline: true });
  fields.push({ name: 'Targets Hit', value: String(stats.targetsHit), inline: true });
  fields.push({ name: 'Stopped Out', value: String(stats.stopsHit), inline: true });

  if (stats.winRate !== null) {
    fields.push({ name: 'Win Rate', value: `${stats.winRate}%`, inline: true });
  }
  if (stats.netTicks !== null) {
    fields.push({ name: 'Net Result', value: `${signed(stats.netTicks)} ticks`, inline: true });
  }
  if (stats.counts.trim) {
    fields.push({ name: 'Trims', value: String(stats.counts.trim), inline: true });
  }

  if (stats.tickers.length) {
    fields.push({
      name: 'Tickers',
      value: truncate(stats.tickers.join(' · '), DISCORD_LIMITS.fieldValue),
      inline: false,
    });
  }

  if (stats.tradeLines.length) {
    const suffix = stats.extraTrades ? `\n_+${stats.extraTrades} more in the app_` : '';
    fields.push({
      name: 'Trade Log',
      value: truncate(stats.tradeLines.join('\n') + suffix, DISCORD_LIMITS.fieldValue),
      inline: false,
    });
  }

  if (stats.wins.count) {
    const pnl = stats.wins.totalPnl;
    const pnlText = pnl ? ` · $${pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })} banked` : '';
    fields.push({
      name: 'Member Wins',
      value: truncate(
        `${stats.wins.count} win${stats.wins.count === 1 ? '' : 's'} posted to the Wins Wall${pnlText}`,
        DISCORD_LIMITS.fieldValue
      ),
      inline: false,
    });
  }

  const headline = stats.netTicks !== null
    ? `${stats.netTicks >= 0 ? '🟢' : '🔴'} **${signed(stats.netTicks)} ticks** on ${stats.totalAlerts} alert${stats.totalAlerts === 1 ? '' : 's'}.`
    : `**${stats.totalAlerts} alert${stats.totalAlerts === 1 ? '' : 's'}** posted today.`;

  const session = stats.firstAlertAt && stats.lastAlertAt
    ? `\nSession: ${formatMarketTime(stats.firstAlertAt, stats.timeZone)} – ${formatMarketTime(stats.lastAlertAt, stats.timeZone)} ET`
    : '';

  return {
    username: process.env.DISCORD_RECAP_USERNAME || `${appName} Recap`,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: truncate(`📊 Daily Recap — ${formatLongDate(stats.date)}`, DISCORD_LIMITS.title),
        description: truncate(headline + session, DISCORD_LIMITS.description),
        color: stats.netTicks === null ? NEUTRAL : stats.netTicks >= 0 ? GREEN : RED,
        fields: fields.slice(0, DISCORD_LIMITS.fields),
        footer: { text: truncate(appName, DISCORD_LIMITS.footer) },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function webhookUrl(): Promise<string | null> {
  const fromEnv = process.env.DISCORD_RECAP_WEBHOOK_URL?.trim();
  if (fromEnv) return fromEnv;

  try {
    const row = await db('app_settings').where({ key: 'discord_recap_webhook_url' }).first();
    return row?.value?.trim() || null;
  } catch {
    return null;
  }
}

async function record(date: string, status: string, stats: RecapStats | null, error?: string) {
  await db('daily_recaps')
    .insert({
      recap_date: date,
      status,
      stats: stats ? JSON.stringify(stats) : null,
      error: error || null,
      posted_at: db.fn.now(),
    })
    .onConflict('recap_date')
    .merge(['status', 'stats', 'error', 'posted_at']);
}

/**
 * Build and post the recap for one trading day.
 *
 * - `dryRun` builds the payload and touches nothing.
 * - `force` re-posts a day that was already posted, and posts a weekend or a
 *   day with no activity (market holidays produce no activity, so they are
 *   skipped without needing a holiday calendar).
 */
export async function runDailyRecap({
  date,
  force = false,
  dryRun = false,
}: { date?: string; force?: boolean; dryRun?: boolean } = {}): Promise<RecapResult> {
  const recapDate = date || marketDate(new Date(), MARKET_TZ);
  const stats = await collectRecapStats(recapDate);

  if (dryRun) {
    return {
      status: 'preview',
      date: recapDate,
      stats,
      payload: buildRecapPayload(stats, await brandName()),
    };
  }

  if (!force) {
    const existing = await db('daily_recaps').where({ recap_date: recapDate }).first();
    if (existing && existing.status === 'posted') {
      return { status: 'already_posted', date: recapDate, stats, payload: null };
    }

    if (isWeekend(recapDate)) {
      return { status: 'skipped', date: recapDate, reason: 'weekend', stats, payload: null };
    }

    if (!stats.hasActivity) {
      await record(recapDate, 'skipped', stats);
      return { status: 'skipped', date: recapDate, reason: 'no activity', stats, payload: null };
    }
  }

  const url = await webhookUrl();
  if (!url) {
    throw new Error('DISCORD_RECAP_WEBHOOK_URL is not configured');
  }

  const payload = buildRecapPayload(stats, await brandName());

  try {
    await postToDiscordWebhook(url, payload);
  } catch (err: any) {
    await record(recapDate, 'failed', stats, String(err?.message || err));
    throw err;
  }

  await record(recapDate, 'posted', stats);
  return { status: 'posted', date: recapDate, stats, payload };
}
