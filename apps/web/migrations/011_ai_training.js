exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE ai_training_examples (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      input_context TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      human_override TEXT,
      was_overridden BOOLEAN DEFAULT FALSE,
      quality_score INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS ai_training_examples;');
};
