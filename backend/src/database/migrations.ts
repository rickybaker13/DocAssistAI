import { getPool } from './db.js';

// ---------------------------------------------------------------------------
// Table DDL — PostgreSQL syntax
// ---------------------------------------------------------------------------

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS scribe_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  specialty     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
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
}
