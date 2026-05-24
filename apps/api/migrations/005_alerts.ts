import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID REFERENCES users(id),
      content TEXT NOT NULL,
      ticker VARCHAR(20),
      direction VARCHAR(10),
      entry_price DECIMAL(12,4),
      target_price DECIMAL(12,4),
      stop_price DECIMAL(12,4),
      result_ticks INTEGER,
      alert_type VARCHAR(30) DEFAULT 'trade' CHECK (alert_type IN ('trade', 'trim', 'target', 'stop', 'commentary', 'morning', 'warning')),
      channel_slug VARCHAR(100),
      has_image BOOLEAN DEFAULT FALSE,
      image_url TEXT,
      is_historical BOOLEAN DEFAULT FALSE,
      original_discord_id VARCHAR(50),
      original_timestamp TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS alerts;');
}
