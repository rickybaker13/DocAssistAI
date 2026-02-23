import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeNotesRouter from './scribeNotes';
import { ScribeUserModel } from '../models/scribeUser';
import { closeDb } from '../database/db';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/notes', scribeNotesRouter);

const SECRET = 'test-secret';
let authCookie: string;
let userId: string;

describe('Scribe Notes Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const userModel = new ScribeUserModel();
    const user = userModel.create({ email: 'notes-route@test.com', passwordHash: 'hash' });
    userId = user.id;
    const token = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(() => closeDb());

  it('POST / — creates a note', async () => {
    const res = await request(app)
      .post('/api/scribe/notes')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note', patientLabel: 'Bed 3' });
    expect(res.status).toBe(201);
    expect(res.body.note.note_type).toBe('progress_note');
  });

  it('GET / — lists notes for authenticated user', async () => {
    const res = await request(app).get('/api/scribe/notes').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notes)).toBe(true);
  });

  it('GET /:id — gets single note with sections', async () => {
    const createRes = await request(app)
      .post('/api/scribe/notes')
      .set('Cookie', authCookie)
      .send({ noteType: 'h_and_p' });
    const noteId = createRes.body.note.id;
    const res = await request(app).get(`/api/scribe/notes/${noteId}`).set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.note.id).toBe(noteId);
    expect(Array.isArray(res.body.sections)).toBe(true);
  });

  it('PUT /:id — updates note fields', async () => {
    const createRes = await request(app)
      .post('/api/scribe/notes')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note' });
    const noteId = createRes.body.note.id;
    const res = await request(app)
      .put(`/api/scribe/notes/${noteId}`)
      .set('Cookie', authCookie)
      .send({ transcript: 'Transcribed text here', status: 'finalized' });
    expect(res.status).toBe(200);
    expect(res.body.note.status).toBe('finalized');
  });

  it('DELETE /:id — soft-deletes note', async () => {
    const createRes = await request(app)
      .post('/api/scribe/notes')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note' });
    const noteId = createRes.body.note.id;
    const delRes = await request(app).delete(`/api/scribe/notes/${noteId}`).set('Cookie', authCookie);
    expect(delRes.status).toBe(200);
    const getRes = await request(app).get(`/api/scribe/notes/${noteId}`).set('Cookie', authCookie);
    expect(getRes.status).toBe(404);
  });

  it('GET / — returns 401 without auth cookie', async () => {
    const res = await request(app).get('/api/scribe/notes');
    expect(res.status).toBe(401);
  });

  it('POST /:id/sections — bulk saves generated sections', async () => {
    const createRes = await request(app)
      .post('/api/scribe/notes')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note' });
    const noteId = createRes.body.note.id;

    const res = await request(app)
      .post(`/api/scribe/notes/${noteId}/sections`)
      .set('Cookie', authCookie)
      .send({
        sections: [
          { name: 'HPI', content: 'Patient presents with...', confidence: 0.9, promptHint: '' },
          { name: 'Assessment', content: 'Likely pneumonia.', confidence: 0.85, promptHint: '' },
        ],
      });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.sections)).toBe(true);
    expect(res.body.sections).toHaveLength(2);
  });
});
