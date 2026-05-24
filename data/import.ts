import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

interface DiscordMessage {
  id: string;
  type: string;
  timestamp: string;
  content: string;
  author: {
    id: string;
    name: string;
    nickname: string;
    avatarUrl: string;
  };
  attachments: Array<{
    id: string;
    url: string;
    fileName: string;
    fileSizeBytes: number;
  }>;
  reactions: Array<{
    emoji: { name: string };
    count: number;
  }>;
}

function extractTicker(content: string): string | null {
  const match = content.match(/\$([A-Z]{1,5})/);
  return match ? match[1] : null;
}

function extractDirection(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.includes('long') || lower.includes('call') || lower.includes('bought calls')) return 'long';
  if (lower.includes('short') || lower.includes('put') || lower.includes('bought puts')) return 'short';
  return null;
}

function classifyAlertType(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('trim') || lower.includes('trimming')) return 'trim';
  if (lower.includes('target') || lower.includes('full target') || lower.includes('tp')) return 'target';
  if (lower.includes('stop') || lower.includes('stopped out')) return 'stop';
  if (lower.includes('good morning') || lower.includes('morning')) return 'morning';
  if (lower.includes('caution') || lower.includes('careful') || lower.includes('warning')) return 'warning';
  if (lower.includes('watching') || lower.includes('analysis') || lower.includes('looking at')) return 'commentary';
  return 'trade';
}

async function importAlerts() {
  console.log('Importing alerts...');
  const raw = fs.readFileSync(path.join(__dirname, 'solano_alerts_discord.json'), 'utf-8');
  const data = JSON.parse(raw);
  const messages: DiscordMessage[] = data.messages || [];

  // Get Sean's user ID from DB
  const seanResult = await pool.query("SELECT id FROM users WHERE username = 'seansolano' LIMIT 1");
  const seanId = seanResult.rows[0]?.id;

  if (!seanId) {
    console.error('Sean user not found. Run seeds first.');
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (!msg.content && msg.attachments.length === 0) {
      skipped++;
      continue;
    }

    const ticker = extractTicker(msg.content || '');
    const direction = extractDirection(msg.content || '');
    const alertType = classifyAlertType(msg.content || '');
    const hasImage = msg.attachments.length > 0;
    const imageUrl = hasImage ? msg.attachments[0].url : null;

    try {
      await pool.query(
        `INSERT INTO alerts (author_id, content, ticker, direction, alert_type, channel_slug, has_image, image_url, is_historical, original_discord_id, original_timestamp, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $10)
         ON CONFLICT DO NOTHING`,
        [
          seanId,
          msg.content || '[Image]',
          ticker,
          direction,
          alertType,
          'solano-alerts',
          hasImage,
          imageUrl,
          msg.id,
          msg.timestamp,
        ]
      );
      imported++;
    } catch (err: any) {
      console.error(`Failed to import alert ${msg.id}: ${err.message}`);
      skipped++;
    }

    if (imported % 1000 === 0 && imported > 0) {
      console.log(`  Imported ${imported} alerts...`);
    }
  }

  console.log(`Alerts import complete: ${imported} imported, ${skipped} skipped`);
}

async function importWins() {
  console.log('Importing wins...');
  const raw = fs.readFileSync(path.join(__dirname, 'soa_wins_discord.json'), 'utf-8');
  const data = JSON.parse(raw);
  const messages: DiscordMessage[] = data.messages || [];

  let imported = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (!msg.content && msg.attachments.length === 0) {
      skipped++;
      continue;
    }

    const hasScreenshot = msg.attachments.length > 0;
    const screenshotUrl = hasScreenshot ? msg.attachments[0].url : null;
    const reactionCount = (msg.reactions || []).reduce((sum: number, r: any) => sum + (r.count || 0), 0);

    // Try to extract PnL from content
    let pnlAmount: number | null = null;
    const pnlMatch = (msg.content || '').match(/\$?([\d,]+(?:\.\d{2})?)/);
    if (pnlMatch) {
      const val = parseFloat(pnlMatch[1].replace(/,/g, ''));
      if (val > 0 && val < 1000000) pnlAmount = val;
    }

    // Classify win type
    let winType = 'trade_win';
    const lower = (msg.content || '').toLowerCase();
    if (lower.includes('payout') || lower.includes('paid out')) winType = 'payout';
    else if (lower.includes('passed') || lower.includes('prop firm') || lower.includes('funded')) winType = 'prop_firm_pass';
    else if (lower.includes('first') || lower.includes('first win')) winType = 'first_win';

    try {
      await pool.query(
        `INSERT INTO student_wins (caption, screenshot_url, win_type, pnl_amount, reaction_count, is_historical, original_discord_id, original_author_name, original_timestamp, created_at)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $8)
         ON CONFLICT DO NOTHING`,
        [
          msg.content || null,
          screenshotUrl,
          winType,
          pnlAmount,
          reactionCount,
          msg.id,
          msg.author?.nickname || msg.author?.name || 'Unknown',
          msg.timestamp,
        ]
      );
      imported++;
    } catch (err: any) {
      console.error(`Failed to import win ${msg.id}: ${err.message}`);
      skipped++;
    }

    if (imported % 500 === 0 && imported > 0) {
      console.log(`  Imported ${imported} wins...`);
    }
  }

  console.log(`Wins import complete: ${imported} imported, ${skipped} skipped`);
}

async function main() {
  console.log('Starting SOA data import...');
  console.log('Database:', process.env.DATABASE_URL ? 'configured' : 'NOT SET');

  try {
    await importAlerts();
    await importWins();
    console.log('\nAll imports complete!');
  } catch (err) {
    console.error('Import failed:', err);
  } finally {
    await pool.end();
  }
}

main();
