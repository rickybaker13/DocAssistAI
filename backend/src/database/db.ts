import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { CREATE_TABLES, COLUMN_MIGRATIONS } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../../data/scribe.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : DB_PATH;
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Split and run each statement individually since prepare() only handles one at a time
    const statements = CREATE_TABLES.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      db.prepare(stmt).run();
    }

    // Run column migrations: add new columns to pre-existing tables.
    // Checks PRAGMA table_info first so it's safe to run on fresh DBs too.
    for (const migration of COLUMN_MIGRATIONS) {
      const row = db
        .prepare(`SELECT COUNT(*) as count FROM pragma_table_info('${migration.table}') WHERE name = '${migration.column}'`)
        .get() as { count: number };
      if (row.count === 0) {
        db.prepare(migration.sql).run();
      }
    }
  }
  return db;
}

export function closeDb(): void {
  if (db) { db.close(); db = null; }
}
