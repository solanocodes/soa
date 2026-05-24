exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      category VARCHAR(50),
      channel_type VARCHAR(20) DEFAULT 'text' CHECK (channel_type IN ('text', 'voice', 'alerts', 'journal')),
      required_tier VARCHAR(20) DEFAULT 'FREE',
      position INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS channels;');
};
