exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE journal_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      ticker VARCHAR(20),
      direction VARCHAR(10) CHECK (direction IN ('long', 'short')),
      entry_price DECIMAL(12,4),
      exit_price DECIMAL(12,4),
      position_size DECIMAL(10,4),
      pnl DECIMAL(12,2),
      pnl_ticks INTEGER,
      setup_type VARCHAR(100),
      notes TEXT,
      emotion_before VARCHAR(50),
      emotion_after VARCHAR(50),
      followed_rules BOOLEAN,
      screenshot_url TEXT,
      trade_date DATE,
      entry_time TIME,
      exit_time TIME,
      is_shared BOOLEAN DEFAULT FALSE,
      coach_reviewed BOOLEAN DEFAULT FALSE,
      coach_notes TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE user_stats (
      user_id UUID PRIMARY KEY REFERENCES users(id),
      total_trades INTEGER DEFAULT 0,
      winning_trades INTEGER DEFAULT 0,
      losing_trades INTEGER DEFAULT 0,
      win_rate DECIMAL(5,2) DEFAULT 0,
      total_pnl DECIMAL(12,2) DEFAULT 0,
      best_trade DECIMAL(12,2) DEFAULT 0,
      worst_trade DECIMAL(12,2) DEFAULT 0,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      green_days INTEGER DEFAULT 0,
      red_days INTEGER DEFAULT 0,
      days_active INTEGER DEFAULT 0,
      last_trade_date DATE,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS user_stats;');
  await knex.raw('DROP TABLE IF EXISTS journal_entries;');
};
