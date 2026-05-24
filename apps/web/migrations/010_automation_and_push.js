exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE automation_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      event_type VARCHAR(100) NOT NULL,
      scheduled_for TIMESTAMP NOT NULL,
      executed_at TIMESTAMP,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed', 'cancelled')),
      payload JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await knex.raw(`
    CREATE TABLE push_notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      title VARCHAR(255),
      body TEXT,
      data JSONB,
      sent_at TIMESTAMP DEFAULT NOW(),
      opened_at TIMESTAMP
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS push_notifications;');
  await knex.raw('DROP TABLE IF EXISTS automation_events;');
};
