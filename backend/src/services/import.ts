import fs from 'fs';
import path from 'path';
import pool, { query } from '../config/database';

interface AlertImport {
  ticker: string;
  direction?: string;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  setup_type?: string;
  notes?: string;
  screenshot_url?: string;
  status?: string;
  result_pnl?: number;
  channel_slug: string;
  coach_username?: string;
  created_at?: string;
}

interface WinImport {
  username: string;
  ticker?: string;
  pnl?: number;
  pnl_percent?: number;
  screenshot_url?: string;
  description?: string;
  created_at?: string;
}

export async function importAlerts(filePath: string): Promise<{ imported: number; errors: number }> {
  let imported = 0;
  let errors = 0;

  try {
    const absolutePath = path.resolve(filePath);
    const rawData = fs.readFileSync(absolutePath, 'utf8');
    const alerts: AlertImport[] = JSON.parse(rawData);

    console.log(`Importing ${alerts.length} alerts from ${absolutePath}...`);

    for (const alert of alerts) {
      try {
        // Find channel
        const channelResult = await query(
          'SELECT id FROM channels WHERE slug = $1',
          [alert.channel_slug]
        );

        if (channelResult.rows.length === 0) {
          console.warn(`Channel not found: ${alert.channel_slug}, skipping alert`);
          errors++;
          continue;
        }

        // Find coach user (or use admin)
        let coachId: string;
        if (alert.coach_username) {
          const coachResult = await query(
            'SELECT id FROM users WHERE username = $1',
            [alert.coach_username]
          );
          if (coachResult.rows.length > 0) {
            coachId = coachResult.rows[0].id;
          } else {
            const admin = await query("SELECT id FROM users WHERE email = 'sean@simplyoptionsacademy.com'");
            coachId = admin.rows[0]?.id;
          }
        } else {
          const admin = await query("SELECT id FROM users WHERE email = 'sean@simplyoptionsacademy.com'");
          coachId = admin.rows[0]?.id;
        }

        if (!coachId) {
          errors++;
          continue;
        }

        await query(
          `INSERT INTO alerts (channel_id, user_id, ticker, direction, entry_price, stop_loss, take_profit, setup_type, notes, screenshot_url, status, result_pnl, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT DO NOTHING`,
          [
            channelResult.rows[0].id,
            coachId,
            alert.ticker.toUpperCase(),
            alert.direction || null,
            alert.entry_price || null,
            alert.stop_loss || null,
            alert.take_profit || null,
            alert.setup_type || null,
            alert.notes || null,
            alert.screenshot_url || null,
            alert.status || 'closed',
            alert.result_pnl || null,
            alert.created_at || new Date().toISOString(),
          ]
        );

        imported++;
      } catch (error: any) {
        console.error(`Error importing alert for ${alert.ticker}:`, error.message);
        errors++;
      }
    }

    console.log(`Import complete: ${imported} imported, ${errors} errors`);
  } catch (error: any) {
    console.error('Import alerts failed:', error.message);
    throw error;
  }

  return { imported, errors };
}

export async function importWins(filePath: string): Promise<{ imported: number; errors: number }> {
  let imported = 0;
  let errors = 0;

  try {
    const absolutePath = path.resolve(filePath);
    const rawData = fs.readFileSync(absolutePath, 'utf8');
    const wins: WinImport[] = JSON.parse(rawData);

    console.log(`Importing ${wins.length} wins from ${absolutePath}...`);

    for (const win of wins) {
      try {
        // Find user
        const userResult = await query(
          'SELECT id FROM users WHERE username = $1',
          [win.username]
        );

        if (userResult.rows.length === 0) {
          console.warn(`User not found: ${win.username}, skipping win`);
          errors++;
          continue;
        }

        await query(
          `INSERT INTO student_wins (user_id, ticker, pnl, pnl_percent, screenshot_url, description, is_verified, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
          [
            userResult.rows[0].id,
            win.ticker ? win.ticker.toUpperCase() : null,
            win.pnl || null,
            win.pnl_percent || null,
            win.screenshot_url || null,
            win.description || null,
            win.created_at || new Date().toISOString(),
          ]
        );

        imported++;
      } catch (error: any) {
        console.error(`Error importing win for ${win.username}:`, error.message);
        errors++;
      }
    }

    console.log(`Import complete: ${imported} imported, ${errors} errors`);
  } catch (error: any) {
    console.error('Import wins failed:', error.message);
    throw error;
  }

  return { imported, errors };
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  if (!command || !filePath) {
    console.log('Usage: ts-node src/services/import.ts <alerts|wins> <file_path>');
    process.exit(1);
  }

  (async () => {
    try {
      if (command === 'alerts') {
        const result = await importAlerts(filePath);
        console.log(`Done: ${result.imported} alerts imported, ${result.errors} errors`);
      } else if (command === 'wins') {
        const result = await importWins(filePath);
        console.log(`Done: ${result.imported} wins imported, ${result.errors} errors`);
      } else {
        console.log('Unknown command. Use "alerts" or "wins".');
      }
    } catch (error) {
      console.error('Import failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}
