exports.up = async function(knex) {
  // Update channel names to capitalized versions
  const updates = [
    { slug: 'welcome', name: '👋 Welcome' },
    { slug: 'announcements', name: '📢 Announcements' },
    { slug: 'introductions', name: '👋 Introductions' },
    { slug: 'schedule', name: '🕐 Schedule' },
    { slug: 'main-chat', name: '💬 Main Chat' },
    { slug: 'share-your-wins', name: '🏆 Share Your Wins' },
    { slug: 'currently-trading', name: '📈 Currently Trading' },
    { slug: 'trade-journal', name: '📅 Trade Journal' },
    { slug: 'strategy-help', name: '🔧 Strategy Help' },
    { slug: 'best-wins', name: '👑 Best Wins' },
    { slug: 'mastery-course', name: '📚 Mastery Course' },
    { slug: 'futures-lab', name: '🧪 Futures Lab' },
    { slug: 'trade-sessions', name: '🔗 Trade Sessions' },
    { slug: 'masterclasses', name: '🎯 Masterclasses' },
    { slug: 'recaps-and-lessons', name: '🔁 Recaps And Lessons' },
    { slug: 'solano-alerts', name: '🚨 Solano Alerts' },
    { slug: 'demon-alerts', name: '🚨 Demon Alerts' },
    { slug: 'bryce-alerts', name: '🚨 Bryce Alerts' },
  ];

  for (const { slug, name } of updates) {
    await knex('channels').where({ slug }).update({ name });
  }

  // Rename options-alerts to wealth-alerts
  await knex('channels').where({ slug: 'options-alerts' }).update({
    name: '💰 Wealth Alerts',
    slug: 'wealth-alerts',
  });

  // Delete bot-feed
  await knex('channels').where({ slug: 'bot-feed' }).del();
};

exports.down = async function(knex) {};
