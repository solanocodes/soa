exports.up = async function(knex) {
  await knex.raw(`
    ALTER TABLE direct_messages
    ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT FALSE;
  `);

  // Index for efficiently querying pending AI suggestions per thread
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_dm_pending_suggestions
    ON direct_messages (thread_id, is_ai_generated, is_pending)
    WHERE is_ai_generated = TRUE AND is_pending = TRUE;
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_dm_pending_suggestions;');
  await knex.raw('ALTER TABLE direct_messages DROP COLUMN IF EXISTS is_pending;');
};
