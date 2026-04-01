import { getPool } from './db.js';

// ---------------------------------------------------------------------------
// Table DDL — PostgreSQL syntax
// ---------------------------------------------------------------------------

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS scribe_users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  password_hash         TEXT NOT NULL,
  name                  TEXT,
  specialty             TEXT,
  subscription_status   TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at         TIMESTAMPTZ,
  period_ends_at        TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_section_templates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES scribe_users(id),
  name        TEXT NOT NULL,
  prompt_hint TEXT,
  is_prebuilt INTEGER DEFAULT 0,
  category    TEXT DEFAULT 'general',
  disciplines TEXT DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS note_templates (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES scribe_users(id),
  note_type  TEXT NOT NULL,
  name       TEXT NOT NULL,
  verbosity  TEXT NOT NULL DEFAULT 'standard',
  sections   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS scribe_billing_preferences (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  phone               TEXT,
  payment_method      TEXT NOT NULL,
  network             TEXT,
  monthly_price_usd   NUMERIC(10,2) NOT NULL,
  discount_percent    NUMERIC(5,2) NOT NULL DEFAULT 0,
  effective_price_usd NUMERIC(10,2) NOT NULL,
  trial_days          INTEGER NOT NULL DEFAULT 7,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scribe_password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_password_reset_otps (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  otp_hash   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_payment_history (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  square_payment_id TEXT,
  amount_cents     INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'completed',
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_feedback (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new',
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_exit_surveys (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  suggestion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_signup_tracking (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  email               TEXT NOT NULL,
  name                TEXT,
  specialty           TEXT,
  signup_source       TEXT,
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  referral_code       TEXT,
  device_type         TEXT,
  user_agent          TEXT,
  ip_country          TEXT,
  ip_region           TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  billing_cycle       TEXT,
  payment_method      TEXT,
  trial_ends_at       TIMESTAMPTZ,
  converted_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  non_conversion_reason TEXT,
  non_conversion_detail TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_notes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  note_type     TEXT NOT NULL,
  patient_label TEXT NOT NULL DEFAULT '',
  verbosity     TEXT NOT NULL DEFAULT 'standard',
  transcript    TEXT NOT NULL DEFAULT '',
  sections      JSONB NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_comp_codes (
  id         TEXT PRIMARY KEY,
  code       TEXT UNIQUE NOT NULL,
  label      TEXT,
  max_uses   INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT REFERENCES scribe_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scribe_comp_code_redemptions (
  id          TEXT PRIMARY KEY,
  code_id     TEXT NOT NULL REFERENCES scribe_comp_codes(id),
  user_id     TEXT NOT NULL REFERENCES scribe_users(id),
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code_id, user_id)
);
`;

// ---------------------------------------------------------------------------
// Column migrations — for databases created before certain columns existed.
// Each entry is checked via information_schema before executing ALTER TABLE,
// so it is safe to run repeatedly on any DB (fresh or existing).
// ---------------------------------------------------------------------------

interface ColumnMigration {
  table: string;
  column: string;
  sql: string;
}

const COLUMN_MIGRATIONS: ColumnMigration[] = [
  // Added category + disciplines to section templates in v0.3 (Phase 6 — discipline filtering)
  {
    table: 'scribe_section_templates',
    column: 'category',
    sql: `ALTER TABLE scribe_section_templates ADD COLUMN category TEXT DEFAULT 'general'`,
  },
  {
    table: 'scribe_section_templates',
    column: 'disciplines',
    sql: `ALTER TABLE scribe_section_templates ADD COLUMN disciplines TEXT DEFAULT '[]'`,
  },
  // Subscription lifecycle tracking
  {
    table: 'scribe_users',
    column: 'subscription_status',
    sql: `ALTER TABLE scribe_users ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trialing'`,
  },
  {
    table: 'scribe_users',
    column: 'trial_ends_at',
    sql: `ALTER TABLE scribe_users ADD COLUMN trial_ends_at TIMESTAMPTZ`,
  },
  {
    table: 'scribe_users',
    column: 'period_ends_at',
    sql: `ALTER TABLE scribe_users ADD COLUMN period_ends_at TIMESTAMPTZ`,
  },
  {
    table: 'scribe_users',
    column: 'cancelled_at',
    sql: `ALTER TABLE scribe_users ADD COLUMN cancelled_at TIMESTAMPTZ`,
  },
  {
    table: 'scribe_users',
    column: 'square_customer_id',
    sql: `ALTER TABLE scribe_users ADD COLUMN square_customer_id TEXT`,
  },
  {
    table: 'scribe_users',
    column: 'square_card_id',
    sql: `ALTER TABLE scribe_users ADD COLUMN square_card_id TEXT`,
  },
  {
    table: 'scribe_users',
    column: 'is_admin',
    sql: `ALTER TABLE scribe_users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE`,
  },
  // TOS / Privacy Policy consent tracking
  {
    table: 'scribe_users',
    column: 'tos_accepted_at',
    sql: `ALTER TABLE scribe_users ADD COLUMN tos_accepted_at TIMESTAMPTZ`,
  },
  {
    table: 'scribe_users',
    column: 'privacy_accepted_at',
    sql: `ALTER TABLE scribe_users ADD COLUMN privacy_accepted_at TIMESTAMPTZ`,
  },
  {
    table: 'scribe_users',
    column: 'tos_version',
    sql: `ALTER TABLE scribe_users ADD COLUMN tos_version TEXT`,
  },
  // Billing cycle: 'monthly' or 'annual'
  {
    table: 'scribe_users',
    column: 'billing_cycle',
    sql: `ALTER TABLE scribe_users ADD COLUMN billing_cycle TEXT DEFAULT 'monthly'`,
  },
  // Billing code suggestions opt-in
  {
    table: 'scribe_users',
    column: 'billing_codes_enabled',
    sql: `ALTER TABLE scribe_users ADD COLUMN billing_codes_enabled BOOLEAN DEFAULT FALSE`,
  },
  // Trial reminder email stage tracking (0=none, 1=welcome, 2=midpoint, 3=urgent)
  {
    table: 'scribe_users',
    column: 'trial_reminder_stage',
    sql: `ALTER TABLE scribe_users ADD COLUMN trial_reminder_stage INTEGER DEFAULT 0`,
  },
  // CodeAssist: user role and coding team assignment
  {
    table: 'scribe_users',
    column: 'user_role',
    sql: `ALTER TABLE scribe_users ADD COLUMN user_role VARCHAR(50) DEFAULT 'clinician'`,
  },
  {
    table: 'scribe_users',
    column: 'coding_team_id',
    sql: `ALTER TABLE scribe_users ADD COLUMN coding_team_id UUID`,
  },
];

// ---------------------------------------------------------------------------
// runMigrations — call once at server startup after initPool()
// ---------------------------------------------------------------------------

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  // 1. Create tables (idempotent via IF NOT EXISTS)
  const statements = CREATE_TABLES_SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.query(stmt);
  }

  // 2. Column migrations — checked via information_schema before ALTER TABLE
  for (const migration of COLUMN_MIGRATIONS) {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = $1 AND column_name = $2`,
      [migration.table, migration.column],
    );
    if ((result.rowCount ?? 0) === 0) {
      await pool.query(migration.sql);
    }
  }

  // 3. Backfill trial_ends_at for existing users that don't have it set
  await pool.query(
    `UPDATE scribe_users SET trial_ends_at = created_at + INTERVAL '7 days' WHERE trial_ends_at IS NULL`,
  );

  // 4. Backfill scribe_signup_tracking for existing users who don't have a tracking row yet
  await pool.query(
    `INSERT INTO scribe_signup_tracking (id, user_id, email, name, specialty, subscription_status, billing_cycle, trial_ends_at, converted_at, cancelled_at, created_at, updated_at)
     SELECT gen_random_uuid()::text, su.id, su.email, su.name, su.specialty,
            su.subscription_status,
            su.billing_cycle,
            su.trial_ends_at,
            CASE WHEN su.subscription_status = 'active' THEN su.updated_at END,
            su.cancelled_at,
            su.created_at,
            NOW()
     FROM scribe_users su
     WHERE NOT EXISTS (
       SELECT 1 FROM scribe_signup_tracking st WHERE st.user_id = su.id
     )`,
  );
}
