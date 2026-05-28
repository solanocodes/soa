exports.up = async function(knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await knex('app_settings').insert([
    { key: 'logo_url', value: '' },
    { key: 'app_name', value: 'SOA' },
    { key: 'app_subtitle', value: 'Simply Options Academy' },
  ]).onConflict('key').ignore();
};

exports.down = async function(knex) {
  await knex.raw('DROP TABLE IF EXISTS app_settings;');
};
