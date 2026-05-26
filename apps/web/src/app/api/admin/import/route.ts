import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/database';
import { requireAuth, errorResponse } from '@/lib/api-helpers';

function classifyAlertType(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('trim') || lower.includes('trimming')) return 'trim';
  if (lower.includes('target hit') || lower.includes('full target') || lower.includes('🎯')) return 'target';
  if (lower.includes('stopped') || lower.includes('stop hit') || lower.includes('stop loss')) return 'stop';
  if (lower.includes('good morning') || lower.includes('gm ') || lower.includes('premarket')) return 'morning';
  if (lower.includes('warning') || lower.includes('⚠️') || lower.includes('careful')) return 'warning';
  if (lower.includes('watching') || lower.includes('eyes on') || lower.includes('note')) return 'commentary';
  return 'trade';
}

function extractTicker(content: string): string | null {
  const patterns = [
    /\b(NQ|ES|MNQ|MES|SPY|QQQ|SPX|NDX)\b/i,
    /\$([A-Z]{1,5})\b/,
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

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    if (!authUser.isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const { type, messages } = await req.json();

    if (!type || !messages || !Array.isArray(messages)) {
      return errorResponse('type (alerts|wins) and messages array required', 400);
    }

    const adminUser = await db('users').where({ is_admin: true }).first();
    if (!adminUser) {
      return errorResponse('Admin user not found in DB', 500);
    }

    let imported = 0;

    if (type === 'alerts') {
      const batchSize = 50;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const records = batch
          .filter((msg: any) => msg.content || (msg.attachments && msg.attachments.length > 0))
          .map((msg: any) => ({
            author_id: adminUser.id,
            content: msg.content || '[attachment]',
            ticker: extractTicker(msg.content || ''),
            direction: extractDirection(msg.content || ''),
            alert_type: classifyAlertType(msg.content || ''),
            channel_slug: 'solano-alerts',
            has_image: msg.attachments && msg.attachments.length > 0,
            image_url: msg.attachments?.[0]?.url || null,
            is_historical: true,
            original_discord_id: msg.id,
            original_timestamp: new Date(msg.timestamp),
            created_at: new Date(msg.timestamp),
          }));

        for (const record of records) {
          try {
            await db('alerts').insert(record);
            imported++;
          } catch {
            // skip duplicates or errors
          }
        }
      }
    } else if (type === 'wins') {
      const batchSize = 50;
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const records = batch
          .filter((msg: any) => msg.content || (msg.attachments && msg.attachments.length > 0))
          .map((msg: any) => ({
            user_id: null,
            caption: msg.content || null,
            screenshot_url: msg.attachments?.[0]?.url || null,
            win_type: 'trade_win',
            pnl_amount: null,
            is_verified: false,
            is_featured: false,
            reaction_count: 0,
            is_historical: true,
            original_discord_id: msg.id,
            original_author_name: msg.author?.nickname || msg.author?.name || 'Student',
            original_timestamp: new Date(msg.timestamp),
            created_at: new Date(msg.timestamp),
          }));

        for (const record of records) {
          try {
            await db('student_wins').insert(record);
            imported++;
          } catch {
            // skip duplicates or errors
          }
        }
      }
    } else {
      return errorResponse('type must be "alerts" or "wins"', 400);
    }

    return NextResponse.json({ imported, type });
  } catch (err: any) {
    console.error('Import error:', err);
    return errorResponse(err.message || 'Import failed', err.status || 500);
  }
}
