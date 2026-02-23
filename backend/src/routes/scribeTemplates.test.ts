import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeTemplatesRouter from './scribeTemplates';
import { ScribeUserModel } from '../models/scribeUser';
import { ScribeSectionTemplateModel } from '../models/scribeSectionTemplate';
import { closeDb } from '../database/db';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/templates', scribeTemplatesRouter);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe Templates Routes', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const userModel = new ScribeUserModel();
    const user = userModel.create({ email: 'tmpl-route@test.com', passwordHash: 'hash' });
    new ScribeSectionTemplateModel().seedPrebuilt();
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(() => closeDb());

  it('GET / — returns prebuilt + user templates', async () => {
    const res = await request(app).get('/api/scribe/templates').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  it('GET /prebuilt — returns only prebuilt sections', async () => {
    const res = await request(app).get('/api/scribe/templates/prebuilt').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.templates.every((t: any) => t.is_prebuilt === 1)).toBe(true);
  });

  it('POST / — creates custom section', async () => {
    const res = await request(app)
      .post('/api/scribe/templates')
      .set('Cookie', authCookie)
      .send({ name: 'My Custom Section', promptHint: 'Custom hint' });
    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('My Custom Section');
    expect(res.body.template.is_prebuilt).toBe(0);
  });

  it('PUT /:id — updates custom section', async () => {
    const createRes = await request(app)
      .post('/api/scribe/templates')
      .set('Cookie', authCookie)
      .send({ name: 'Original' });
    const id = createRes.body.template.id;
    const res = await request(app)
      .put(`/api/scribe/templates/${id}`)
      .set('Cookie', authCookie)
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:id — deletes custom section', async () => {
    const createRes = await request(app)
      .post('/api/scribe/templates')
      .set('Cookie', authCookie)
      .send({ name: 'To Delete' });
    const id = createRes.body.template.id;
    const res = await request(app).delete(`/api/scribe/templates/${id}`).set('Cookie', authCookie);
    expect(res.status).toBe(200);
  });
});
