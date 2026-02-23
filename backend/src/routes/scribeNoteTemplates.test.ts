import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeNoteTemplatesRouter from './scribeNoteTemplates';
import { ScribeUserModel } from '../models/scribeUser';
import { ScribeNoteTemplateModel } from '../models/scribeNoteTemplate';
import { closeDb } from '../database/db';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/note-templates', scribeNoteTemplatesRouter);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe Note Templates Routes', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const userModel = new ScribeUserModel();
    const user = userModel.create({ email: 'notetmpl-route@test.com', passwordHash: 'hash' });
    new ScribeNoteTemplateModel().seedSystem();
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(() => closeDb());

  it('GET /?noteType=progress_note — returns system + user templates', async () => {
    const res = await request(app)
      .get('/api/scribe/note-templates?noteType=progress_note')
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  it('GET without noteType — returns 400', async () => {
    const res = await request(app)
      .get('/api/scribe/note-templates')
      .set('Cookie', authCookie);
    expect(res.status).toBe(400);
  });

  it('POST / — creates user template', async () => {
    const res = await request(app)
      .post('/api/scribe/note-templates')
      .set('Cookie', authCookie)
      .send({
        noteType: 'progress_note',
        name: 'My ICU Note',
        verbosity: 'brief',
        sections: [{ name: 'Assessment', promptHint: null }],
      });
    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('My ICU Note');
    expect(res.body.template.verbosity).toBe('brief');
  });

  it('DELETE /:id — deletes user template', async () => {
    const createRes = await request(app)
      .post('/api/scribe/note-templates')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note', name: 'To Delete', verbosity: 'standard', sections: [] });
    const id = createRes.body.template.id;
    const res = await request(app)
      .delete(`/api/scribe/note-templates/${id}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE system template — returns 404', async () => {
    const listRes = await request(app)
      .get('/api/scribe/note-templates?noteType=progress_note')
      .set('Cookie', authCookie);
    const systemTemplate = listRes.body.templates.find((t: any) => t.user_id === null);
    const res = await request(app)
      .delete(`/api/scribe/note-templates/${systemTemplate.id}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });

  it('GET without auth — returns 401', async () => {
    const res = await request(app).get('/api/scribe/note-templates?noteType=progress_note');
    expect(res.status).toBe(401);
  });
});
