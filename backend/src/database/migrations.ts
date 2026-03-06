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
}
