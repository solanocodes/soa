exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE direct_message_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id),
      coach_id UUID REFERENCES users(id),
      ai_mode VARCHAR(20) DEFAULT 'suggest' CHECK (ai_mode IN ('suggest', 'autopilot', 'off')),
      last_message_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(student_id, coach_id)
    );
  `);

  await knex.raw(`
    CREATE TABLE direct_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID REFERENCES direct_message_threads(id) ON DELETE CASCADE,
      sender_id UUID REFERENCES users(id),
      content TEXT NOT NULL,
      is_ai_generated BOOLEAN DEFAULT FALSE,
      ai_confidence DECIMAL(3,2),
      was_edited_before_send BOOLEAN DEFAULT FALSE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS direct_messages;');
  await knex.raw('DROP TABLE IF EXISTS direct_message_threads;');
};
