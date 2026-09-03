#!/usr/bin/env node
/**
 * Post a daily trading recap to Discord from a JSON file (or stdin).
 *
 * Use this when the day's results are typed up by hand rather than pulled from
 * the app database (see docs/DAILY_RECAP.md for the automatic path).
 *
 *   node scripts/post-recap.mjs recap.json
 *   cat recap.json | node scripts/post-recap.mjs
 *   node scripts/post-recap.mjs recap.json --dry-run
 *
 * The webhook comes from DISCORD_RECAP_WEBHOOK_URL, or --webhook <url>.
 * Never commit the webhook URL — it is a credential.
 */

import { readFileSync } from 'node:fs';

const GREEN = 0x22c55e;
const RED = 0xef4444;
const NEUTRAL = 0x6366f1;
const MARKET_TZ = process.env.DAILY_RECAP_TZ || 'America/New_York';

const LIMITS = { title: 256, description: 4096, fieldValue: 1024, fields: 25 };

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { file: null, webhook: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--webhook') args.webhook = argv[++i];
    else if (arg.startsWith('--webhook=')) args.webhook = arg.slice('--webhook='.length);
    else if (!arg.startsWith('-')) args.file = arg;
    else fail(`Unknown option: ${arg}`);
  }
  return args;
}

function readInput(file) {
  const raw = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
  if (!raw.trim()) fail('No input. Pass a JSON file path or pipe JSON on stdin.');
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`Input is not valid JSON: ${err.message}`);
  }
}

function isDiscordWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      /^(canary\.|ptb\.)?discord(app)?\.com$/.test(parsed.hostname) &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

function marketToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MARKET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA gives YYYY-MM-DD
}

function formatLongDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const RESULT_ICON = { win: '✅', loss: '🛑', scratch: '➖', breakeven: '➖', be: '➖', open: '⏳' };

// "✅ **SPY** CALL · 5.20 → 7.00 · +35% — held the 9ema"
function tradeLine(trade) {
  if (typeof trade === 'string') return truncate(`• ${trade}`, 200);

  const result = (trade.result || '').toLowerCase();
  const parts = [RESULT_ICON[result] || '•'];

  parts.push(`**${(trade.ticker || '—').toUpperCase()}**`);
  if (trade.direction) parts.push(String(trade.direction).toUpperCase());
  if (trade.contract) parts.push(String(trade.contract));

  const leg = [trade.entry, trade.exit].filter((v) => v !== undefined && v !== null && v !== '');
  if (leg.length === 2) parts.push(`· ${leg[0]} → ${leg[1]}`);
  else if (leg.length === 1) parts.push(`· @ ${leg[0]}`);

  if (trade.pnl !== undefined && trade.pnl !== null && trade.pnl !== '') parts.push(`· **${trade.pnl}**`);
  if (trade.notes) parts.push(`— ${trade.notes}`);

  return truncate(parts.join(' '), 200);
}

function countResults(trades) {
  const tally = { wins: 0, losses: 0, other: 0 };
  for (const trade of trades) {
    const result = typeof trade === 'string' ? '' : String(trade.result || '').toLowerCase();
    if (result === 'win') tally.wins++;
    else if (result === 'loss') tally.losses++;
    else tally.other++;
  }
  return tally;
}

// A P&L can arrive as a number or as text like "+$1,240" / "-2.5R".
function pnlDirection(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Math.sign(value);
  const text = String(value).trim();
  if (/^-/.test(text)) return -1;
  if (/^\+/.test(text)) return 1;
  const numeric = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? Math.sign(numeric) : 0;
}

function formatPnl(value) {
  if (typeof value !== 'number') return String(value);
  const abs = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${value >= 0 ? '+' : '-'}$${abs}`;
}

export function buildPayload(input) {
  const date = input.date || marketToday();
  const trades = Array.isArray(input.trades) ? input.trades : [];
  const tally = countResults(trades);

  const wins = input.wins ?? tally.wins;
  const losses = input.losses ?? tally.losses;
  const decided = wins + losses;
  const winRate = input.winRate ?? (decided ? `${Math.round((wins / decided) * 100)}%` : null);

  const fields = [];
  if (trades.length || decided) {
    fields.push({ name: 'Trades', value: String(input.tradeCount ?? trades.length), inline: true });
    fields.push({ name: 'Wins', value: String(wins), inline: true });
    fields.push({ name: 'Losses', value: String(losses), inline: true });
  }
  if (winRate) fields.push({ name: 'Win Rate', value: String(winRate), inline: true });

  const netPnl = input.netPnl ?? input.pnl ?? null;
  if (netPnl !== null && netPnl !== '') {
    fields.push({ name: 'Net P&L', value: formatPnl(netPnl), inline: true });
  }
  if (input.tickers?.length) {
    fields.push({
      name: 'Tickers',
      value: truncate(input.tickers.join(' · '), LIMITS.fieldValue),
      inline: false,
    });
  }
  if (trades.length) {
    fields.push({
      name: 'Trade Log',
      value: truncate(trades.map(tradeLine).join('\n'), LIMITS.fieldValue),
      inline: false,
    });
  }

  const notes = Array.isArray(input.notes) ? input.notes : input.notes ? [input.notes] : [];
  if (notes.length) {
    fields.push({
      name: input.notesTitle || 'Notes & Lessons',
      value: truncate(notes.map((note) => `• ${note}`).join('\n'), LIMITS.fieldValue),
      inline: false,
    });
  }

  const direction = netPnl !== null ? pnlDirection(netPnl) : wins - losses;
  const color = input.color ?? (direction > 0 ? GREEN : direction < 0 ? RED : NEUTRAL);

  const headlineBits = [];
  if (netPnl !== null && netPnl !== '') {
    headlineBits.push(`${direction >= 0 ? '🟢' : '🔴'} **${formatPnl(netPnl)}** on the day`);
  }
  if (decided) headlineBits.push(`${wins}W / ${losses}L`);
  const headline = headlineBits.join(' · ');

  const description = [headline, input.summary].filter(Boolean).join('\n\n');

  return {
    username: process.env.DISCORD_RECAP_USERNAME || 'SOA Recap',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: truncate(`📊 Daily Recap — ${formatLongDate(date)}`, LIMITS.title),
        description: truncate(description || 'No trades today.', LIMITS.description),
        color,
        fields: fields.slice(0, LIMITS.fields),
        footer: { text: input.footer || 'Simply Options Academy' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function post(webhookUrl, payload) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 204) return;

    const body = await res.text().catch(() => '');
    if (res.status === 429 && attempt < 4) {
      let waitMs = 2000 * attempt;
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed.retry_after === 'number') waitMs = Math.ceil(parsed.retry_after * 1000) + 250;
      } catch { /* keep the linear backoff */ }
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 30000)));
      continue;
    }
    if (res.status < 500) fail(`Discord rejected the post (${res.status}): ${body.slice(0, 300)}`);
    if (attempt === 4) fail(`Discord error ${res.status} after 4 attempts`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = readInput(args.file);
  const payload = buildPayload(input);

  if (args.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const webhookUrl = args.webhook || process.env.DISCORD_RECAP_WEBHOOK_URL;
  if (!webhookUrl) fail('Set DISCORD_RECAP_WEBHOOK_URL or pass --webhook <url>.');
  if (!isDiscordWebhookUrl(webhookUrl)) fail('That does not look like a Discord webhook URL.');

  await post(webhookUrl, payload);
  console.log(`✓ Recap posted for ${input.date || marketToday()}`);
}

// Only run when invoked directly, so buildPayload stays importable for tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => fail(err?.message || String(err)));
}
