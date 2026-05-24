import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      content TEXT,
      message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'alert', 'win', 'system', 'ai')),
      is_pinned BOOLEAN DEFAULT FALSE,
      is_deleted BOOLEAN DEFAULT FALSE,
      reply_to_id UUID REFERENCES messages(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE message_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
      file_url TEXT NOT NULL,
      file_name VARCHAR(255),
      file_type VARCHAR(50),
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE message_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      emoji VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS message_reactions;');
  await knex.raw('DROP TABLE IF EXISTS message_attachments;');
  await knex.raw('DROP TABLE IF EXISTS messages;');
}
