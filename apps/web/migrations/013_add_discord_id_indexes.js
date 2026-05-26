exports.up = async function(knex) {
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_discord_id
    ON alerts(original_discord_id)
    WHERE original_discord_id IS NOT NULL;
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_wins_discord_id
    ON student_wins(original_discord_id)
    WHERE original_discord_id IS NOT NULL;
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_alerts_discord_id;');
  await knex.raw('DROP INDEX IF EXISTS idx_wins_discord_id;');
};
