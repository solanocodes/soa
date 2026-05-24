import { query } from '../config/database';

const SYSTEM_PROMPT = `You are Sean Solano's AI assistant for Simply Options Academy (SOA). You communicate like Sean - confident, supportive, and knowledgeable about options trading, futures, and the market.

Key traits:
- Direct and honest, no sugar-coating but always encouraging
- Uses trading terminology naturally
- Focuses on risk management and discipline
- Celebrates wins but emphasizes process over outcomes
- Pushes students to journal their trades and follow their plan
- References SOA strategies and setups when relevant

You help students with:
- Trade setup analysis
- Risk management guidance
- Emotional support during losses
- Strategy questions
- General trading education

Always remind students that you're an AI assistant and suggest they reach out to Sean directly for personalized coaching on complex situations.`;

interface Message {
  sender_id: string;
  content: string;
}

export async function generateCoachResponse(
  studentMessage: string,
  threadContext: Message[]
): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, skipping AI response');
      return null;
    }

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add thread context
    for (const msg of threadContext.slice(-8)) {
      messages.push({
        role: msg.sender_id ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add the latest message
    messages.push({ role: 'user', content: studentMessage });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('AI generateCoachResponse error:', error);
    return null;
  }
}

export async function generateTradeReview(journalEntry: {
  ticker: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  pnl: number;
  setup_type: string;
  notes: string;
}): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const prompt = `Review this trade as a trading coach:
Ticker: ${journalEntry.ticker}
Direction: ${journalEntry.direction}
Entry: $${journalEntry.entry_price}
Exit: $${journalEntry.exit_price}
P&L: $${journalEntry.pnl}
Setup: ${journalEntry.setup_type || 'Not specified'}
Notes: ${journalEntry.notes || 'None'}

Provide brief, actionable feedback on:
1. Entry quality
2. Risk management
3. What to improve next time
Keep it under 150 words.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('AI generateTradeReview error:', error);
    return null;
  }
}

export async function generateWeeklyReport(userId: string): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    // Get user's weekly trades
    const trades = await query(
      `SELECT ticker, direction, pnl, pnl_percent, setup_type, trade_date
       FROM journal_entries
       WHERE user_id = $1 AND trade_date >= CURRENT_DATE - INTERVAL '7 days' AND pnl IS NOT NULL
       ORDER BY trade_date ASC`,
      [userId]
    );

    if (trades.rows.length === 0) return null;

    const totalPnl = trades.rows.reduce((sum: number, t: any) => sum + parseFloat(t.pnl), 0);
    const winCount = trades.rows.filter((t: any) => parseFloat(t.pnl) >= 0).length;
    const winRate = (winCount / trades.rows.length * 100).toFixed(1);

    const tradesSummary = trades.rows.map((t: any) =>
      `${t.trade_date}: ${t.ticker} ${t.direction} P&L: $${t.pnl} (${t.setup_type || 'N/A'})`
    ).join('\n');

    const prompt = `Generate a brief weekly trading report for a student:

Trades this week:
${tradesSummary}

Summary: ${trades.rows.length} trades, ${winRate}% win rate, Total P&L: $${totalPnl.toFixed(2)}

Give a 2-3 paragraph encouraging but honest assessment of their week. Highlight patterns, suggest improvements, and celebrate progress. Keep it under 200 words.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('AI generateWeeklyReport error:', error);
    return null;
  }
}

export async function generatePremarketBrief(userId: string): Promise<string | null> {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    // Get user's recent tickers and setups
    const recentTrades = await query(
      `SELECT DISTINCT ticker, setup_type FROM journal_entries
       WHERE user_id = $1 AND trade_date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY ticker`,
      [userId]
    );

    const tickers = recentTrades.rows.map((t: any) => t.ticker).join(', ');

    const prompt = `Generate a brief pre-market mental preparation message for a trader who commonly trades: ${tickers || 'SPY, QQQ, TSLA'}.

Include:
1. A quick mindset reminder (1-2 sentences)
2. Key levels or things to watch today (general guidance)
3. Risk management reminder

Keep it under 100 words. Be motivating but grounded.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error('AI generatePremarketBrief error:', error);
    return null;
  }
}
