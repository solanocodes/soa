// Minimal Discord webhook client.
//
// Discord rate-limits webhooks per channel and answers with 429 +
// `retry_after` (seconds) rather than queueing, so a bare fetch will silently
// drop a recap the first time two posts land close together.

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type DiscordEmbed = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
};

export type DiscordWebhookPayload = {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  allowed_mentions?: { parse: string[] };
};

// Discord's documented embed caps. Exceeding any of them fails the whole post
// with a 400, so callers truncate rather than gamble.
export const DISCORD_LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  fields: 25,
  footer: 2048,
  content: 2000,
};

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function isDiscordWebhookUrl(url: string): boolean {
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function postToDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
  { maxAttempts = 4, timeoutMs = 15000 }: { maxAttempts?: number; timeoutMs?: number } = {}
): Promise<void> {
  if (!isDiscordWebhookUrl(webhookUrl)) {
    throw new Error('Not a valid Discord webhook URL');
  }

  let lastError = '';

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.ok || res.status === 204) return;

      const body = await res.text().catch(() => '');
      lastError = `Discord responded ${res.status}: ${body.slice(0, 300)}`;

      if (res.status === 429) {
        let waitMs = 2000 * attempt;
        try {
          const parsed = JSON.parse(body);
          if (typeof parsed.retry_after === 'number') {
            waitMs = Math.ceil(parsed.retry_after * 1000) + 250;
          }
        } catch {
          // fall back to the linear backoff above
        }
        if (attempt < maxAttempts) {
          await sleep(Math.min(waitMs, 30000));
          continue;
        }
      }

      // 4xx other than rate limiting means the payload itself is wrong;
      // retrying sends the same bad payload again.
      if (res.status < 500 && res.status !== 429) break;
    } catch (err: any) {
      lastError = err?.name === 'AbortError'
        ? `Discord request timed out after ${timeoutMs}ms`
        : `Discord request failed: ${err?.message || err}`;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < maxAttempts) await sleep(1000 * 2 ** (attempt - 1));
  }

  throw new Error(lastError || 'Discord webhook post failed');
}
