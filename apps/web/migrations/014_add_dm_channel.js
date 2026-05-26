exports.up = async function(knex) {
  // Shift all Coaching Corner positions up by 1 to make room
  await knex('channels')
    .where('category', 'Coaching Corner')
    .increment('position', 1);

  // Insert Direct Messages as first item in Coaching Corner
  await knex('channels').insert({
    name: '✉️ Direct Messages',
    slug: 'direct-messages',
    category: 'Coaching Corner',
    channel_type: 'text',
    required_tier: 'SOA_CORE',
    position: 10,
    is_active: true,
  }).onConflict('slug').ignore();
};

exports.down = async function(knex) {
  await knex('channels').where({ slug: 'direct-messages' }).del();
};
