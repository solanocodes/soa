import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: path.resolve(__dirname, '../../migrations'),
    extension: 'ts',
  },
  seeds: {
    directory: path.resolve(__dirname, '../../seeds'),
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

export default config;
module.exports = config;
