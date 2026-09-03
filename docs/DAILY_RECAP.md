# Daily Trading Recap → Discord

Posts one summary of the trading day into a Discord channel via a webhook,
automatically, after the close.

## Setup (one time)

1. **Create the webhook in Discord**
   Server Settings → Integrations → Webhooks → *New Webhook*. Pick the channel
   the recap should land in, name it (e.g. "SOA Recap"), then **Copy Webhook URL**.

2. **Set the environment variables** (Railway → the web service → Variables):

   | Variable | Required | Default | Purpose |
   | --- | --- | --- | --- |
   | `DISCORD_RECAP_WEBHOOK_URL` | yes | – | The webhook URL copied above |
   | `RECAP_CRON_SECRET` | recommended | – | Shared secret for triggering the recap over HTTP |
   | `DAILY_RECAP_CRON` | no | `15 16 * * 1-5` | When to post (cron, market time) |
   | `DAILY_RECAP_TZ` | no | `America/New_York` | Market timezone |
   | `DAILY_RECAP_ENABLED` | no | `true` | Set `false` to turn the schedule off |
   | `DISCORD_RECAP_USERNAME` | no | `<app name> Recap` | Name the bot posts under |

   The webhook URL can instead be stored in the `app_settings` table under the
   key `discord_recap_webhook_url`; the environment variable wins when both are set.

3. **Run migrations** — `npm run db:migrate --workspace=apps/web`. Railway already
   runs this on deploy (`db:setup`).

## When it posts

The scheduler starts with the web server (`src/instrumentation.ts`) and fires at
**4:15pm ET on weekdays** by default — 15 minutes after the close, so late trims
are included.

A recap is **skipped**, not posted, when:

- it's a weekend, or
- the day had no alerts and no wins (this is what covers market holidays — no
  holiday calendar is needed), or
- a recap for that date was already posted (safe across restarts and redeploys).

Every attempt is recorded in the `daily_recaps` table (`posted` / `skipped` /
`failed`, with the stats snapshot and any error).

## What's in it

Built from what was posted in the app that market day, excluding historical
Discord backfills:

- trades called, targets hit, stopped out, trims
- win rate (targets ÷ decided trades) and net ticks
- tickers traded
- a trade log line per entry/exit with time, ticker, direction and prices
- member wins posted to the Wins Wall that day, with total P&L

## Posting a recap you typed up yourself

When the day's results are in your head rather than in the app, describe the day
in a small JSON file and post it directly — no database, no deploy:

```bash
export DISCORD_RECAP_WEBHOOK_URL="https://discord.com/api/webhooks/..."

node scripts/post-recap.mjs recap.json --dry-run   # see the exact payload first
node scripts/post-recap.mjs recap.json             # post it
```

`docs/recap-example.json` is a filled-in template. Every field is optional:

| Field | Notes |
| --- | --- |
| `date` | `YYYY-MM-DD`; defaults to today in market time |
| `summary` | Free text under the headline |
| `netPnl` | Number (`1240` → `+$1,240`) or text (`"+564 ticks"`, `"+2.4R"`) |
| `tickers` | List of symbols traded |
| `trades[]` | `ticker`, `direction`, `contract`, `entry`, `exit`, `result` (`win`/`loss`/`scratch`/`open`), `pnl`, `notes` |
| `notes` | Bullets — lessons, rule breaks, what to repeat |

Wins, losses and win rate are counted from `trades[].result` unless you set them
explicitly. Embed colour follows the day: green up, red down.

## Manual control

Preview today's recap without posting:

```bash
curl -H "Authorization: Bearer $RECAP_CRON_SECRET" \
  "https://<your-app>/api/recap/daily"
```

Post now (e.g. after a missed run), or re-post a specific day:

```bash
curl -X POST -H "Authorization: Bearer $RECAP_CRON_SECRET" \
  "https://<your-app>/api/recap/daily?date=2026-09-03&force=true"
```

Admin and coach accounts can call the same endpoint with their normal JWT
instead of the cron secret. `force=true` also overrides the weekend and
no-activity skips.

### External scheduler instead of the built-in one

If the web service ever runs more than one instance, set
`DAILY_RECAP_ENABLED=false` and drive it from a single external scheduler
(Railway cron, GitHub Actions, cron-job.org) hitting the `POST` endpoint with
the cron secret. The duplicate guard means a double-fire still only posts once.
