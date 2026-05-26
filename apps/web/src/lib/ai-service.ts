import Anthropic from '@anthropic-ai/sdk';
import db from './database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SEAN_SYSTEM_PROMPT = `You are Sean Solano, a professional NQ and SPY/QQQ day trader and trading educator. You run Simply Options Academy (SOA).

Your communication style:
- Direct, casual, encouraging but no-nonsense
- You trade using technical analysis only — VWAP, orderblocks, key levels
- You size lighter in uncertain conditions, take trims into strength, hold runners to key targets
- You don't trade individual stocks
- You always tell students to protect their accounts above all else
- You use phrases like "let's get it", "stay disciplined", "protect your account", "LFG"
- You're supportive but real — you don't sugarcoat
- You keep responses concise — 1-3 sentences usually, never long paragraphs
- You frame everything as education, never financial advice

When a student asks about a specific trade setup, reference VWAP, orderblocks, and key levels.
When a student shares a loss, be encouraging but direct about what to improve.
When a student shares a win, celebrate with them and reinforce what they did right.
For billing/account/technical questions, tell them to email sean@simplyoptionsacademy.com.`;

export async function generateAIResponse(
  studentMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ response: string; confidence: number }> {
  // Get some training examples from historical alerts
  const trainingExamples = await db('alerts')
    .where('is_historical', true)
    .orderByRaw('RANDOM()')
    .limit(5)
    .select('content');

  const examplesContext = trainingExamples.length > 0
    ? `\n\nHere are some examples of how Sean communicates in his alerts:\n${trainingExamples.map((e: { content: string }) => `- "${e.content}"`).join('\n')}`
    : '';

  const systemPrompt = SEAN_SYSTEM_PROMPT + examplesContext;

  const messages = [
    ...conversationHistory.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: studentMessage },
  ];

  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages,
  });

  const response = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
  const confidence = estimateConfidence(studentMessage, response);

  return { response, confidence };
}

function estimateConfidence(input: string, _response: string): number {
  let confidence = 0.8;

  const tradingKeywords = ['vwap', 'orderblock', 'level', 'entry', 'exit', 'stop', 'target', 'trim', 'runner', 'nq', 'es', 'spy', 'qqq'];
  const hasTradingContext = tradingKeywords.some(k => input.toLowerCase().includes(k));
  if (hasTradingContext) confidence += 0.1;

  if (input.length > 500) confidence -= 0.1;
  if (input.includes('?') && input.split('?').length > 3) confidence -= 0.15;

  const personalKeywords = ['billing', 'refund', 'cancel', 'payment', 'account issue', 'technical problem', "can't login"];
  if (personalKeywords.some(k => input.toLowerCase().includes(k))) confidence -= 0.3;

  return Math.max(0.1, Math.min(1.0, confidence));
}

export async function generatePremarketBrief(userId: string): Promise<string> {
  const user = await db('users').where('id', userId).first();
  if (!user) return '';

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return `Good morning ${user.display_name || user.username}.\nToday is ${dayOfWeek}.\nStay disciplined. Let's get it.`;
}

export async function generateWeeklyReport(userId: string): Promise<string> {
  const user = await db('users').where('id', userId).first();
  if (!user) return '';

  const wins = await db('student_wins')
    .where('user_id', userId)
    .where('created_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
    .count('* as count')
    .first();

  const winCount = parseInt(String(wins?.count || '0'));

  return `Hey ${user.display_name || user.username}, here's your week:\n- Wins posted: ${winCount}\n- Keep showing up and staying disciplined.\n- One thing to focus on this week: consistency over big plays.`;
}
