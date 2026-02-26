import { jest } from '@jest/globals';
import { ScribeNoteTemplateModel } from './scribeNoteTemplate.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('ScribeNoteTemplateModel', () => {
  const model = new ScribeNoteTemplateModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'notetmpl@test.com', passwordHash: 'hash' });
    userId = user.id;
    await model.seedSystem();
  });
  afterAll(async () => { await closePool(); });

  it('seeds system templates (user_id is null)', async () => {
    const system = await model.listSystem('progress_note');
    expect(system.length).toBeGreaterThan(0);
    expect(system.every(t => t.user_id === null)).toBe(true);
  });

  it('does not double-seed on second call', async () => {
    await model.seedSystem();
    const system = await model.listSystem('progress_note');
    expect(system.length).toBe(1);
  });

  it('lists system + user templates for a note type', async () => {
    const all = await model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.user_id === null)).toBe(true);
  });

  it('creates a user template', async () => {
    const tmpl = await model.create({
      userId,
      noteType: 'progress_note',
      name: 'My ICU Progress Note',
      verbosity: 'brief',
      sections: [{ name: 'Assessment', promptHint: null }, { name: 'Plan', promptHint: null }],
    });
    expect(tmpl.id).toBeTruthy();
    expect(tmpl.name).toBe('My ICU Progress Note');
    expect(tmpl.verbosity).toBe('brief');
    expect(JSON.parse(tmpl.sections).length).toBe(2);
  });

  it('user template appears in listForUser', async () => {
    const all = await model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.name === 'My ICU Progress Note')).toBe(true);
  });

  it('deletes user template', async () => {
    const tmpl = await model.create({
      userId,
      noteType: 'progress_note',
      name: 'To Delete',
      verbosity: 'standard',
      sections: [],
    });
    const result = await model.delete(tmpl.id, userId);
    expect(result.rowCount).toBe(1);
    const after = await model.listForUser(userId, 'progress_note');
    expect(after.some(t => t.id === tmpl.id)).toBe(false);
  });

  it('cannot delete system template', async () => {
    const system = await model.listSystem('progress_note');
    const result = await model.delete(system[0].id, userId);
    expect(result.rowCount).toBe(0);
  });
});
