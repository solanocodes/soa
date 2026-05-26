const bcrypt = require('bcryptjs');

const CHANNELS = [
  { name: '👋 Welcome', slug: 'welcome', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 1 },
  { name: '📢 Announcements', slug: 'announcements', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 2 },
  { name: '👋 Introductions', slug: 'introductions', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 3 },
  { name: '🕐 Schedule', slug: 'schedule', category: 'Onboarding', channel_type: 'text', required_tier: 'FREE', position: 4 },
  { name: '💬 Main Chat', slug: 'main-chat', category: 'Chatting Corner', channel_type: 'text', required_tier: 'FREE', position: 5 },
  { name: '🏆 Share Your Wins', slug: 'share-your-wins', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 6 },
  { name: '📈 Currently Trading', slug: 'currently-trading', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 7 },
  { name: '📅 Trade Journal', slug: 'trade-journal', category: 'Chatting Corner', channel_type: 'journal', required_tier: 'SOA_CORE', position: 8 },
  { name: '🔧 Strategy Help', slug: 'strategy-help', category: 'Chatting Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 9 },
  { name: '✉️ Direct Messages', slug: 'direct-messages', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 10 },
  { name: '👑 Best Wins', slug: 'best-wins', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 11 },
  { name: '📚 Mastery Course', slug: 'mastery-course', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 11 },
  { name: '🧪 Futures Lab', slug: 'futures-lab', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 12 },
  { name: '🔗 Trade Sessions', slug: 'trade-sessions', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 13 },
  { name: '🎯 Masterclasses', slug: 'masterclasses', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 14 },
  { name: '🔁 Recaps And Lessons', slug: 'recaps-and-lessons', category: 'Coaching Corner', channel_type: 'text', required_tier: 'SOA_CORE', position: 15 },
  { name: '🚨 Solano Alerts', slug: 'solano-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 16 },
  { name: '🚨 Demon Alerts', slug: 'demon-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 17 },
  { name: '🚨 Bryce Alerts', slug: 'bryce-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_CORE', position: 18 },
  { name: '💰 Wealth Alerts', slug: 'wealth-alerts', category: 'Coaching Corner', channel_type: 'alerts', required_tier: 'SOA_WEALTH', position: 19 },
  { name: '📡 Live Trading', slug: 'live-trading', category: 'Live', channel_type: 'voice', required_tier: 'SOA_CORE', position: 20 },
  { name: '👥 Student Room', slug: 'student-room', category: 'Live', channel_type: 'voice', required_tier: 'SOA_CORE', position: 21 },
];

exports.seed = async function(knex) {
  // Insert admin user
  const passwordHash = await bcrypt.hash('admin123', 10);

  await knex('users').insert({
    email: 'sean@simplyoptionsacademy.com',
    password_hash: passwordHash,
    username: 'solano',
    display_name: 'Sean Solano',
    tier: 'BOT_PRODUCT',
    is_admin: true,
    is_coach: true,
    referral_code: 'SOLANO',
    onboarding_completed: true,
  }).onConflict('email').ignore();

  // Insert all channels
  for (const channel of CHANNELS) {
    await knex('channels').insert({
      name: channel.name,
      slug: channel.slug,
      category: channel.category,
      channel_type: channel.channel_type,
      required_tier: channel.required_tier,
      position: channel.position,
      is_active: true,
    }).onConflict('slug').ignore();
  }
};
