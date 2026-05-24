exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE live_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      host_id UUID REFERENCES users(id),
      title VARCHAR(255),
      livekit_room_name VARCHAR(255),
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      replay_url TEXT,
      required_tier VARCHAR(20) DEFAULT 'SOA_CORE',
      viewer_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS live_sessions;');
};
