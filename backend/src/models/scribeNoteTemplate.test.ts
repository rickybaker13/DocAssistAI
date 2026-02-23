import { ScribeNoteTemplateModel } from './scribeNoteTemplate';
import { ScribeUserModel } from './scribeUser';
import { closeDb } from '../database/db';

describe('ScribeNoteTemplateModel', () => {
  const model = new ScribeNoteTemplateModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    const user = userModel.create({ email: 'notetmpl@test.com', passwordHash: 'hash' });
    userId = user.id;
    model.seedSystem();
  });
  afterAll(() => closeDb());

  it('seeds system templates (user_id is null)', () => {
    const system = model.listSystem('progress_note');
    expect(system.length).toBeGreaterThan(0);
    expect(system.every(t => t.user_id === null)).toBe(true);
  });

  it('does not double-seed on second call', () => {
    model.seedSystem();
    const system = model.listSystem('progress_note');
    expect(system.length).toBe(1);
  });

  it('lists system + user templates for a note type', () => {
    const all = model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.user_id === null)).toBe(true);
  });

  it('creates a user template', () => {
    const tmpl = model.create({
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

  it('user template appears in listForUser', () => {
    const all = model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.name === 'My ICU Progress Note')).toBe(true);
  });

  it('deletes user template', () => {
    const tmpl = model.create({
      userId,
      noteType: 'progress_note',
      name: 'To Delete',
      verbosity: 'standard',
      sections: [],
    });
    const result = model.delete(tmpl.id, userId);
    expect(result.changes).toBe(1);
    const after = model.listForUser(userId, 'progress_note');
    expect(after.some(t => t.id === tmpl.id)).toBe(false);
  });

  it('cannot delete system template', () => {
    const system = model.listSystem('progress_note');
    const result = model.delete(system[0].id, userId);
    expect(result.changes).toBe(0);
  });
});
