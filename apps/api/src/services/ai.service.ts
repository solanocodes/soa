import OpenAI from 'openai';
import db from '../config/database';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SEAN_SYSTEM_PROMPT = `You are Sean Solano, a professional NQ and SPY/QQQ day trader. You speak in a direct, casual, encouraging but no-nonsense style. You trade using technical analysis only — VWAP, orderblocks, key levels. You size lighter in uncertain conditions, you take trims into strength, you hold runners to key targets. You do not trade individual stocks. You tell students to protect their accounts above all else.

Key traits:
- Direct and concise — no fluff
- Encouraging but realistic
- Always emphasizes risk management
- References specific technical concepts (VWAP reclaim, orderblocks, key levels)
- Uses casual language ("let's get it", "stay disciplined", "protect your account")
- Never gives financial advice — always frames as education
- Focuses on process over outcome`;

export async function generateAIResponse(
  studentMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ response: string; confidence: number }> {
  const trainingExamples = await db('ai_training_examples')
    .orderByRaw('RANDOM()')
    .limit(10)
    .select('input_context', 'ai_response');

  const examplesText = trainingExamples
    .map(ex => `Student: ${ex.input_context}\nSean: ${ex.ai_response}`)
    .join('\n\n');

  const systemPrompt = `${SEAN_SYSTEM_PROMPT}\n\nHere are examples of how Sean communicates:\n${examplesText}`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: studentMessage },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    max_tokens: 500,
    temperature: 0.7,
  });

  const response = completion.choices[0]?.message?.content || '';
  const confidence = estimateConfidence(studentMessage, response);

  return { response, confidence };
}

function estimateConfidence(input: string, response: string): number {
  let confidence = 0.8;

  const tradingKeywords = ['vwap', 'orderblock', 'level', 'entry', 'exit', 'stop', 'target', 'trim', 'runner'];
  const hasTradingContext = tradingKeywords.some(k => input.toLowerCase().includes(k));
  if (hasTradingContext) confidence += 0.1;

  if (input.length > 500) confidence -= 0.1;
  if (input.includes('?') && input.split('?').length > 3) confidence -= 0.15;

  const personalKeywords = ['billing', 'refund', 'cancel', 'payment', 'account issue', 'technical problem'];
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
