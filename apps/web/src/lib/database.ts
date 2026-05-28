import knex, { Knex } from 'knex';

declare global {
  var __knex: Knex | undefined;
}

const db: Knex = global.__knex ?? knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 0, max: 20, idleTimeoutMillis: 30000 },
  acquireConnectionTimeout: 10000,
});

if (process.env.NODE_ENV !== 'production') {
  global.__knex = db;
}

export default db;
