import { jest } from '@jest/globals';
import { initPool, closePool, getPool } from './db.js';
import { runMigrations } from './migrations.js';

describe('Database', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
  });
  afterAll(async () => { await closePool(); });

  const checkTable = async (tableName: string) => {
    const result = await getPool().query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = $1`,
      [tableName]
    );
    return (result.rowCount ?? 0) > 0;
  };

  it('creates scribe_users table', async () => {
    expect(await checkTable('scribe_users')).toBe(true);
  });
  it('creates scribe_notes table', async () => {
    expect(await checkTable('scribe_notes')).toBe(true);
  });
  it('creates scribe_note_sections table', async () => {
    expect(await checkTable('scribe_note_sections')).toBe(true);
  });
  it('creates scribe_section_templates table', async () => {
    expect(await checkTable('scribe_section_templates')).toBe(true);
  });
  it('creates note_templates table', async () => {
    expect(await checkTable('note_templates')).toBe(true);
  });
});
