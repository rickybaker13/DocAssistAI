import { getDb, closeDb } from './db.js';

describe('Database', () => {
  beforeAll(() => { process.env.NODE_ENV = 'test'; });
  afterAll(() => closeDb());

  it('creates scribe_users table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scribe_users'").get();
    expect(row).toBeTruthy();
  });

  it('creates scribe_notes table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scribe_notes'").get();
    expect(row).toBeTruthy();
  });

  it('creates scribe_note_sections table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scribe_note_sections'").get();
    expect(row).toBeTruthy();
  });

  it('creates scribe_section_templates table', () => {
    const db = getDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='scribe_section_templates'").get();
    expect(row).toBeTruthy();
  });
});
