exports.up = async function(knex) {
  await knex.raw(`
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tier_check;
    ALTER TABLE users ADD CONSTRAINT users_tier_check
      CHECK (tier IN ('FREE', 'MENTORSHIP', 'SOA_CORE', 'INNER_CIRCLE', 'SOA_WEALTH', 'BOT_PRODUCT'));
  `);
};

exports.down = async function(knex) {};
