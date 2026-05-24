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
  embeds: Array<{
    title?: string;
    description?: string;
    fields?: Array<{ name: string; value: string }>;
  }>;
}

interface DiscordExport {
  messages: DiscordMessage[];
  messageCount: number;
}

function classifyWinType(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('prop firm') || lower.includes('eval') || lower.includes('passed')) return 'prop_firm_pass';
  if (lower.includes('payout') || lower.includes('withdrawal')) return 'payout';
  if (lower.includes('first') || lower.includes('milestone')) return 'milestone';
  return 'trade_win';
}

function extractPnl(content: string): number | null {
  const patterns = [
    /\+?\$([0-9,]+\.?\d*)/,
    /profit[:\s]*\$?([0-9,]+\.?\d*)/i,
    /pnl[:\s]*\+?\$?([0-9,]+\.?\d*)/i,
    /made[:\s]*\$?([0-9,]+\.?\d*)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return parseFloat(match[1].replace(',', ''));
  }
  return null;
}

async function importWins() {
  const filePath = path.resolve(__dirname, '../data/discord-wins-export.json');

  if (!fs.existsSync(filePath)) {
    console.error('Wins export file not found at:', filePath);
    console.log('Please copy the Discord export JSON to data/discord-wins-export.json');
    process.exit(1);
  }

  console.log('Reading wins export file...');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data: DiscordExport = JSON.parse(raw);

  console.log(`Found ${data.messageCount} messages to import`);

  const batchSize = 100;
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < data.messages.length; i += batchSize) {
    const batch = data.messages.slice(i, i + batchSize);
    const records = batch
      .filter(msg => msg.content || msg.attachments.length > 0)
      .map(msg => ({
        user_id: null,
        caption: msg.content || null,
        screenshot_url: msg.attachments[0]?.url || null,
        win_type: classifyWinType(msg.content),
        pnl_amount: extractPnl(msg.content),
        is_verified: false,
        is_featured: false,
        reaction_count: 0,
        is_historical: true,
        original_discord_id: msg.id,
        original_author_name: msg.author.nickname || msg.author.name,
        original_timestamp: new Date(msg.timestamp),
        created_at: new Date(msg.timestamp),
      }));

    if (records.length > 0) {
      await db('student_wins').insert(records).onConflict('original_discord_id').ignore();
      imported += records.length;
    }
    skipped += batch.length - records.length;

    if ((i + batchSize) % 1000 === 0 || i + batchSize >= data.messages.length) {
      console.log(`Progress: ${Math.min(i + batchSize, data.messages.length)}/${data.messages.length} (imported: ${imported}, skipped: ${skipped})`);
    }
  }

  console.log(`\nImport complete! ${imported} wins imported, ${skipped} skipped.`);
  await db.destroy();
}

importWins().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
