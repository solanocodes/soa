import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE student_wins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      caption TEXT,
      screenshot_url TEXT,
      win_type VARCHAR(30) DEFAULT 'trade_win' CHECK (win_type IN ('trade_win', 'prop_firm_pass', 'payout', 'first_win', 'milestone')),
      pnl_amount DECIMAL(12,2),
      is_verified BOOLEAN DEFAULT FALSE,
      verified_at TIMESTAMP,
      is_featured BOOLEAN DEFAULT FALSE,
      reaction_count INTEGER DEFAULT 0,
      is_historical BOOLEAN DEFAULT FALSE,
      original_discord_id VARCHAR(50),
      original_author_name VARCHAR(255),
      original_timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS student_wins;');
}
