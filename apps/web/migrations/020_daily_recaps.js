exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS daily_recaps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recap_date DATE NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'skipped', 'failed')),
      stats JSONB,
      error TEXT,
      posted_at TIMESTAMP DEFAULT NOW()
    );
  `);
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS daily_recaps;');
};
