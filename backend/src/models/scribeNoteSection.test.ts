import { ScribeNoteSectionModel } from './scribeNoteSection';
import { ScribeNoteModel } from './scribeNote';
import { ScribeUserModel } from './scribeUser';
import { closeDb } from '../database/db';

describe('ScribeNoteSectionModel', () => {
  const sectionModel = new ScribeNoteSectionModel();
  const noteModel = new ScribeNoteModel();
  const userModel = new ScribeUserModel();
  let noteId: string;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    const user = userModel.create({ email: 'sec-test@test.com', passwordHash: 'hash' });
    const note = noteModel.create({ userId: user.id, noteType: 'progress_note' });
    noteId = note.id;
  });
  afterAll(() => closeDb());

  it('creates a section for a note', () => {
    const s = sectionModel.create({ noteId, sectionName: 'Assessment', displayOrder: 0 });
    expect(s.id).toBeTruthy();
    expect(s.section_name).toBe('Assessment');
    expect(s.display_order).toBe(0);
  });

  it('lists sections for a note ordered by display_order', () => {
    sectionModel.create({ noteId, sectionName: 'Plan', displayOrder: 1 });
    sectionModel.create({ noteId, sectionName: 'HPI', displayOrder: 2 });
    const sections = sectionModel.listForNote(noteId);
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections[0].display_order).toBeLessThanOrEqual(sections[1].display_order);
  });

  it('updates section content and confidence', () => {
    const s = sectionModel.create({ noteId, sectionName: 'Objective', displayOrder: 3 });
    sectionModel.update(s.id, { content: 'BP 120/80', confidence: 0.9 });
    const updated = sectionModel.findById(s.id);
    expect(updated!.content).toBe('BP 120/80');
    expect(updated!.confidence).toBe(0.9);
  });

  it('bulk creates sections', () => {
    const sections = [
      { noteId, sectionName: 'Subjective', displayOrder: 10 },
      { noteId, sectionName: 'Medications', displayOrder: 11 },
    ];
    const created = sectionModel.bulkCreate(sections);
    expect(created.length).toBe(2);
  });
});
