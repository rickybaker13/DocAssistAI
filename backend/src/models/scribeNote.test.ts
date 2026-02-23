import { ScribeNoteModel } from './scribeNote';
import { ScribeUserModel } from './scribeUser';
import { closeDb } from '../database/db';
import bcrypt from 'bcryptjs';

describe('ScribeNoteModel', () => {
  const noteModel = new ScribeNoteModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const user = userModel.create({ email: 'note-test@test.com', passwordHash: await bcrypt.hash('pw', 1) });
    userId = user.id;
  });
  afterAll(() => closeDb());

  it('creates a note', () => {
    const note = noteModel.create({ userId, noteType: 'progress_note', patientLabel: 'Bed 4' });
    expect(note.id).toBeTruthy();
    expect(note.user_id).toBe(userId);
    expect(note.note_type).toBe('progress_note');
    expect(note.status).toBe('draft');
  });

  it('lists notes for a user (excludes deleted)', () => {
    const note2 = noteModel.create({ userId, noteType: 'h_and_p' });
    noteModel.softDelete(note2.id, userId);
    const notes = noteModel.listForUser(userId);
    const found = notes.find(n => n.id === note2.id);
    expect(found).toBeUndefined();
  });

  it('finds note by id', () => {
    const note = noteModel.create({ userId, noteType: 'consult_note' });
    const found = noteModel.findById(note.id, userId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(note.id);
  });

  it('updates note transcript and status', () => {
    const note = noteModel.create({ userId, noteType: 'progress_note' });
    noteModel.update(note.id, userId, { transcript: 'Hello world', status: 'finalized' });
    const updated = noteModel.findById(note.id, userId);
    expect(updated!.transcript).toBe('Hello world');
    expect(updated!.status).toBe('finalized');
  });

  it('soft-deletes a note', () => {
    const note = noteModel.create({ userId, noteType: 'progress_note' });
    noteModel.softDelete(note.id, userId);
    const found = noteModel.findById(note.id, userId);
    expect(found).toBeNull();
  });
});
