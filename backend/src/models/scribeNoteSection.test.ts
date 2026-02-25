import { jest } from '@jest/globals';
import { ScribeNoteSectionModel } from './scribeNoteSection.js';
import { ScribeNoteModel } from './scribeNote.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('ScribeNoteSectionModel', () => {
  const sectionModel = new ScribeNoteSectionModel();
  const noteModel = new ScribeNoteModel();
  const userModel = new ScribeUserModel();
  let noteId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'sec-test@test.com', passwordHash: 'hash' });
    const note = await noteModel.create({ userId: user.id, noteType: 'progress_note' });
    noteId = note.id;
  });
  afterAll(async () => { await closePool(); });

  it('creates a section for a note', async () => {
    const s = await sectionModel.create({ noteId, sectionName: 'Assessment', displayOrder: 0 });
    expect(s.id).toBeTruthy();
    expect(s.section_name).toBe('Assessment');
    expect(s.display_order).toBe(0);
  });

  it('lists sections for a note ordered by display_order', async () => {
    await sectionModel.create({ noteId, sectionName: 'Plan', displayOrder: 1 });
    await sectionModel.create({ noteId, sectionName: 'HPI', displayOrder: 2 });
    const sections = await sectionModel.listForNote(noteId);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections[0].display_order).toBeLessThanOrEqual(sections[1].display_order);
  });

  it('updates section content and confidence', async () => {
    const s = await sectionModel.create({ noteId, sectionName: 'Objective', displayOrder: 3 });
    await sectionModel.update(s.id, { content: 'BP 120/80', confidence: 0.9 });
    const updated = await sectionModel.findById(s.id);
    expect(updated!.content).toBe('BP 120/80');
    expect(updated!.confidence).toBe(0.9);
  });

  it('bulk creates sections', async () => {
    const sections = [
      { noteId, sectionName: 'Subjective', displayOrder: 10 },
      { noteId, sectionName: 'Medications', displayOrder: 11 },
    ];
    const created = await sectionModel.bulkCreate(sections);
    expect(created.length).toBe(2);
  });
});
