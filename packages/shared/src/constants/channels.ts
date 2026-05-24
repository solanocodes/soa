import type { Tier } from './tiers';

export interface ChannelSeed {
  name: string;
  slug: string;
  category: string;
  channel_type: 'text' | 'voice' | 'alerts' | 'journal';
  required_tier: Tier;
  position: number;
}

export const CHANNELS: ChannelSeed[] = [
  { name: '👋 welcome', slug: 'welcome', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 1 },
  { name: '📢 announcements', slug: 'announcements', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 2 },
  { name: '👋 introductions', slug: 'introductions', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 3 },
  { name: '🕐 schedule', slug: 'schedule', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 4 },
  { name: '💬 main-chat', slug: 'main-chat', category: 'Chatting Corner', channel_type: 'text', required_tier: 'FREE', position: 5 },
  { name: '🏆 share-your-wins', slug: 'share-your-wins', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 6 },
  { name: '📈 currently-trading', slug: 'currently-trading', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 7 },
  { name: '📅 trade-journal', slug: 'trade-journal', category: 'Chatting Corner', channel_type: 'journal', required_tier: 'SOA_CORE', position: 8 },
  { name: '🔧 strategy-help', slug: 'strategy-help', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 9 },
  { name: '👑 best-wins', slug: 'best-wins', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 10 },
  { name: '📚 mastery-course', slug: 'mastery-course', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 11 },
  { name: '🧪 futures-lab', slug: 'futures-lab', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 12 },
  { name: '🔗 trade-sessions', slug: 'trade-sessions', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 13 },
  { name: '🎯 masterclasses', slug: 'masterclasses', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 14 },
  { name: '🔁 recaps-and-lessons', slug: 'recaps-and-lessons', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 15 },
  { name: '🚨 solano-alerts', slug: 'solano-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 16 },
  { name: '🚨 demon-alerts', slug: 'demon-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 17 },
  { name: '🚨 bryce-alerts', slug: 'bryce-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 18 },
  { name: '💰 options-alerts', slug: 'options-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_WEALTH', position: 19 },
  { name: '🤖 bot-feed', slug: 'bot-feed', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'BOT_PRODUCT', position: 20 },
  { name: '📡 Live Trading', slug: 'live-trading', category: 'Live', channel_type: 'voice', required_tier: 'SOA_CORE', position: 21 },
  { name: '👥 Student Room', slug: 'student-room', category: 'Live', channel_type: 'voice', required_tier: 'SOA_CORE', position: 22 },
];
