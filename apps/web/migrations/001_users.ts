import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      avatar_url TEXT,
      tier VARCHAR(20) DEFAULT 'FREE' CHECK (tier IN ('FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT')),
      tier_expires_at TIMESTAMP,
      stripe_customer_id VARCHAR(255),
      prop_firm_connected BOOLEAN DEFAULT FALSE,
      prop_firm_type VARCHAR(50),
      prop_firm_account_id VARCHAR(255),
      referral_code VARCHAR(20) UNIQUE,
      referred_by UUID REFERENCES users(id),
      referral_credits DECIMAL(10,2) DEFAULT 0,
      is_admin BOOLEAN DEFAULT FALSE,
      is_coach BOOLEAN DEFAULT FALSE,
      onboarding_day INTEGER DEFAULT 0,
      onboarding_completed BOOLEAN DEFAULT FALSE,
      last_active_at TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP TABLE IF EXISTS users;');
}
