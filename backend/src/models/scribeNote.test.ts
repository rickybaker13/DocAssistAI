import { jest } from '@jest/globals';
import { ScribeNoteModel } from './scribeNote.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import bcrypt from 'bcryptjs';

describe('ScribeNoteModel', () => {
  const noteModel = new ScribeNoteModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'note-test@test.com', passwordHash: await bcrypt.hash('pw', 1) });
    userId = user.id;
  });
  afterAll(async () => { await closePool(); });

  it('creates a note', async () => {
    const note = await noteModel.create({ userId, noteType: 'progress_note', patientLabel: 'Bed 4' });
    expect(note.id).toBeTruthy();
    expect(note.user_id).toBe(userId);
    expect(note.note_type).toBe('progress_note');
    expect(note.status).toBe('draft');
  });

  it('lists notes for a user (excludes deleted)', async () => {
    const note2 = await noteModel.create({ userId, noteType: 'h_and_p' });
    await noteModel.softDelete(note2.id, userId);
    const notes = await noteModel.listForUser(userId);
    const found = notes.find(n => n.id === note2.id);
    expect(found).toBeUndefined();
  });

  it('finds note by id', async () => {
    const note = await noteModel.create({ userId, noteType: 'consult_note' });
    const found = await noteModel.findById(note.id, userId);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(note.id);
  });

  it('updates note transcript and status', async () => {
    const note = await noteModel.create({ userId, noteType: 'progress_note' });
    await noteModel.update(note.id, userId, { transcript: 'Hello world', status: 'finalized' });
    const updated = await noteModel.findById(note.id, userId);
    expect(updated!.transcript).toBe('Hello world');
    expect(updated!.status).toBe('finalized');
  });

  it('soft-deletes a note', async () => {
    const note = await noteModel.create({ userId, noteType: 'progress_note' });
    await noteModel.softDelete(note.id, userId);
    const found = await noteModel.findById(note.id, userId);
    expect(found).toBeNull();
  });

  it('creates a note with verbosity', async () => {
    const note = await noteModel.create({ userId, noteType: 'progress_note', verbosity: 'brief' });
    expect(note.verbosity).toBe('brief');
  });

  it('defaults verbosity to standard when not provided', async () => {
    const note = await noteModel.create({ userId, noteType: 'progress_note' });
    expect(note.verbosity).toBe('standard');
  });
});
