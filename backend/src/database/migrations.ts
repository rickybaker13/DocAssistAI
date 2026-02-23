export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS scribe_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  specialty     TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_notes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES scribe_users(id),
  note_type     TEXT NOT NULL,
  patient_label TEXT,
  transcript    TEXT,
  status        TEXT DEFAULT 'draft',
  deleted_at    TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_note_sections (
  id                TEXT PRIMARY KEY,
  note_id           TEXT NOT NULL REFERENCES scribe_notes(id),
  section_name      TEXT NOT NULL,
  content           TEXT,
  prompt_hint       TEXT,
  display_order     INTEGER NOT NULL DEFAULT 0,
  confidence        REAL,
  focused_ai_result TEXT,
  chat_insertions   TEXT DEFAULT '[]',
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_section_templates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES scribe_users(id),
  name        TEXT NOT NULL,
  prompt_hint TEXT,
  is_prebuilt INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);
`;
