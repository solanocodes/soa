import fs from 'fs';
import path from 'path';
import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
});

interface DiscordAttachment {
  id: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
}

interface DiscordMessage {
  id: string;
  type: string;
  timestamp: string;
  content: string;
  author: {
    id: string;
    name: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
  attachments: DiscordAttachment[];
}

interface DiscordExport {
  messages: DiscordMessage[];
  messageCount: number;
}

function classifyAlertType(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('trim') || lower.includes('trimming')) return 'trim';
  if (lower.includes('target hit') || lower.includes('full target') || lower.includes('🎯')) return 'target';
  if (lower.includes('stopped') || lower.includes('stop hit') || lower.includes('stop loss')) return 'stop';
  if (lower.includes('good morning') || lower.includes('gm ') || lower.includes('premarket')) return 'morning';
  if (lower.includes('warning') || lower.includes('⚠️') || lower.includes('careful') || lower.includes('caution')) return 'warning';
  if (lower.includes('watching') || lower.includes('eyes on') || lower.includes('note')) return 'commentary';
  return 'trade';
}

function extractTicker(content: string): string | null {
  const patterns = [
    /\b(NQ|ES|MNQ|MES|SPY|QQQ|SPX|NDX)\b/i,
    /\$([A-Z]{1,5})\b/,
    /\b([A-Z]{2,5})\s+\d+[cp]/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return (match[1] || match[0]).toUpperCase();
  }
  return null;
}

function extractDirection(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.includes('long') || lower.includes('calls') || lower.includes('buy') || lower.includes('bought')) return 'long';
  if (lower.includes('short') || lower.includes('puts') || lower.includes('sell') || lower.includes('sold')) return 'short';
  return null;
}

function extractPrice(content: string, label: string): number | null {
  const patterns = [
    new RegExp(`${label}[:\\s]*\\$?([\\d,]+\\.?\\d*)`, 'i'),
    new RegExp(`${label}[:\\s]*@\\s*\\$?([\\d,]+\\.?\\d*)`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return parseFloat(match[1].replace(',', ''));
  }
  return null;
}

async function importAlerts() {
  const filePath = path.resolve(__dirname, '../data/discord-alerts-export.json');

  if (!fs.existsSync(filePath)) {
    console.error('Alert export file not found at:', filePath);
    console.log('Please copy the Discord export JSON to data/discord-alerts-export.json');
    process.exit(1);
  }

  console.log('Reading alerts export file...');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: DiscordExport = JSON.parse(raw);

  console.log(`Found ${data.messageCount} messages to import`);

  const adminUser = await db('users').where({ is_admin: true }).first();
  if (!adminUser) {
    console.error('Admin user not found. Run seeds first.');
    process.exit(1);
  }

  const batchSize = 100;
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < data.messages.length; i += batchSize) {
    const batch = data.messages.slice(i, i + batchSize);
    const records = batch
      .filter(msg => msg.content || msg.attachments.length > 0)
      .map(msg => ({
        author_id: adminUser.id,
        content: msg.content || '[attachment]',
        ticker: extractTicker(msg.content),
        direction: extractDirection(msg.content),
        entry_price: extractPrice(msg.content, 'entry') || extractPrice(msg.content, 'in at'),
        target_price: extractPrice(msg.content, 'target') || extractPrice(msg.content, 'tp'),
        stop_price: extractPrice(msg.content, 'stop') || extractPrice(msg.content, 'sl'),
        alert_type: classifyAlertType(msg.content),
        channel_slug: 'solano-alerts',
        has_image: msg.attachments.length > 0,
        image_url: msg.attachments[0]?.url || null,
        is_historical: true,
        original_discord_id: msg.id,
        original_timestamp: new Date(msg.timestamp),
        created_at: new Date(msg.timestamp),
      }));

    if (records.length > 0) {
      await db('alerts').insert(records).onConflict('original_discord_id').ignore();
      imported += records.length;
    }
    skipped += batch.length - records.length;

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= data.messages.length) {
      console.log(`Progress: ${Math.min(i + batchSize, data.messages.length)}/${data.messages.length} (imported: ${imported}, skipped: ${skipped})`);
    }
  }

  console.log(`\nImport complete! ${imported} alerts imported, ${skipped} skipped.`);
  await db.destroy();
}

importAlerts().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
