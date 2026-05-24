import pool from '../config/database';

const schema = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  tier VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (tier IN ('FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT')),
  is_admin BOOLEAN DEFAULT FALSE,
  is_coach BOOLEAN DEFAULT FALSE,
  referral_code VARCHAR(20) UNIQUE,
  referred_by UUID REFERENCES users(id),
  stripe_customer_id VARCHAR(100),
  subscription_id VARCHAR(100),
  subscription_status VARCHAR(30),
  subscription_expires_at TIMESTAMPTZ,
  push_token TEXT,
  notification_preferences JSONB DEFAULT '{"alerts": true, "dms": true, "wins": true, "live": true, "marketing": true}'::jsonb,
  refresh_token TEXT,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  tier_expires_at TIMESTAMPTZ,
  onboarding_day INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  prop_firm_connected BOOLEAN DEFAULT FALSE,
  referral_credits DECIMAL(10,2) DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  channel_type VARCHAR(20) DEFAULT 'text' CHECK (channel_type IN ('text', 'alerts', 'voice', 'journal', 'wins')),
  required_tier VARCHAR(20) NOT NULL DEFAULT 'FREE' CHECK (required_tier IN ('FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT')),
  position INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to_id UUID REFERENCES messages(id),
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Message Attachments
CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) CHECK (file_type IN ('image', 'video', 'file')),
  file_name VARCHAR(255),
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message Reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- Direct Message Threads
CREATE TABLE IF NOT EXISTS direct_message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ai_mode VARCHAR(20) DEFAULT 'off' CHECK (ai_mode IN ('off', 'draft', 'auto')),
  ai_persona TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

-- Direct Messages
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES direct_message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_approved BOOLEAN,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_thread_id ON direct_messages(thread_id, created_at DESC);

-- Journal Entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker VARCHAR(20) NOT NULL,
  direction VARCHAR(10) CHECK (direction IN ('LONG', 'SHORT')),
  entry_price DECIMAL(12,4),
  exit_price DECIMAL(12,4),
  quantity DECIMAL(12,4),
  pnl DECIMAL(12,2),
  pnl_percent DECIMAL(8,4),
  setup_type VARCHAR(50),
  notes TEXT,
  screenshot_url TEXT,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  coach_review TEXT,
  coach_reviewed_by UUID REFERENCES users(id),
  coach_reviewed_at TIMESTAMPTZ,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id, trade_date DESC);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  content TEXT,
  ticker VARCHAR(20),
  direction VARCHAR(10) CHECK (direction IN ('LONG', 'SHORT', 'long', 'short')),
  entry_price DECIMAL(12,4),
  stop_loss DECIMAL(12,4),
  take_profit DECIMAL(12,4),
  setup_type VARCHAR(50),
  alert_type VARCHAR(30) DEFAULT 'trade' CHECK (alert_type IN ('trade', 'trim', 'target', 'stop', 'commentary', 'morning', 'warning')),
  notes TEXT,
  screenshot_url TEXT,
  has_image BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  channel_slug VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'hit_tp', 'hit_sl', 'closed', 'expired')),
  result_pnl DECIMAL(12,2),
  is_historical BOOLEAN DEFAULT FALSE,
  original_discord_id VARCHAR(50),
  original_timestamp TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_channel_id ON alerts(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON alerts(ticker);

-- Student Wins
CREATE TABLE IF NOT EXISTS student_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES journal_entries(id),
  ticker VARCHAR(20),
  pnl DECIMAL(12,2),
  pnl_amount DECIMAL(12,2),
  pnl_percent DECIMAL(8,4),
  caption TEXT,
  screenshot_url TEXT,
  description TEXT,
  win_type VARCHAR(30) DEFAULT 'trade_win' CHECK (win_type IN ('trade_win', 'prop_firm_pass', 'payout', 'first_win', 'milestone')),
  reaction_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  verified_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  is_historical BOOLEAN DEFAULT FALSE,
  original_discord_id VARCHAR(50),
  original_author_name VARCHAR(255),
  original_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_wins_user_id ON student_wins(user_id, created_at DESC);

-- Automation Events
CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_data JSONB,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_status ON automation_events(status, scheduled_for);

-- Push Notifications
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  required_tier VARCHAR(20) NOT NULL DEFAULT 'SOA_CORE' CHECK (required_tier IN ('FREE', 'SOA_CORE', 'SOA_WEALTH', 'BOT_PRODUCT')),
  position INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course Modules
CREATE TABLE IF NOT EXISTS course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT,
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course_id ON course_modules(course_id, position);

-- Course Progress
CREATE TABLE IF NOT EXISTS course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  watch_time_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

-- Prop Firm Accounts
CREATE TABLE IF NOT EXISTS prop_firm_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  firm_name VARCHAR(100) NOT NULL,
  account_id VARCHAR(100),
  account_size DECIMAL(12,2),
  current_balance DECIMAL(12,2),
  max_drawdown_percent DECIMAL(8,4),
  current_drawdown_percent DECIMAL(8,4),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'passed', 'failed', 'withdrawn')),
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrals
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'expired')),
  reward_amount DECIMAL(10,2),
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referred_id)
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_id VARCHAR(100),
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  product_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id, created_at DESC);

-- Live Sessions
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  room_name VARCHAR(100) UNIQUE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  replay_url TEXT,
  viewer_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- AI Training Examples
CREATE TABLE IF NOT EXISTS ai_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  input_text TEXT NOT NULL,
  output_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Stats (materialized/cached stats)
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  total_pnl DECIMAL(12,2) DEFAULT 0,
  best_trade_pnl DECIMAL(12,2) DEFAULT 0,
  worst_trade_pnl DECIMAL(12,2) DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  avg_win DECIMAL(12,2) DEFAULT 0,
  avg_loss DECIMAL(12,2) DEFAULT 0,
  win_rate DECIMAL(5,2) DEFAULT 0,
  weekly_pnl DECIMAL(12,2) DEFAULT 0,
  monthly_pnl DECIMAL(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

async function runMigration() {
  try {
    console.log('Running migration...');
    await pool.query(schema);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

export { runMigration };
