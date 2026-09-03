import cron from 'node-cron';
import { runDailyRecap } from './daily-recap';
import { MARKET_TZ } from './market-day';

// 4:15pm ET, weekdays — 15 minutes after the closing bell, so late fills and
// end-of-day trims are already in.
const DEFAULT_CRON = '15 16 * * 1-5';

declare global {
  var __recapCronTask: ReturnType<typeof cron.schedule> | undefined;
}

export function startRecapScheduler(): void {
  if (global.__recapCronTask) return;

  if (process.env.DAILY_RECAP_ENABLED === 'false') {
    console.log('[recap] scheduler disabled (DAILY_RECAP_ENABLED=false)');
    return;
  }

  const expression = process.env.DAILY_RECAP_CRON || DEFAULT_CRON;
  if (!cron.validate(expression)) {
    console.error(`[recap] invalid DAILY_RECAP_CRON "${expression}" — scheduler not started`);
    return;
  }

  global.__recapCronTask = cron.schedule(
    expression,
    async () => {
      try {
        const result = await runDailyRecap();
        if (result.status === 'posted') {
          console.log(`[recap] posted recap for ${result.date} (${result.stats.totalAlerts} alerts)`);
        } else {
          console.log(`[recap] ${result.status} for ${result.date}${result.reason ? ` — ${result.reason}` : ''}`);
        }
      } catch (err: any) {
        console.error('[recap] failed to post daily recap:', err?.message || err);
      }
    },
    { timezone: MARKET_TZ }
  );

  console.log(`[recap] scheduler started — "${expression}" (${MARKET_TZ})`);
}
