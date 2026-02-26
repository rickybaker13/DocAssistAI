import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeTemplatesRouter from './scribeTemplates.js';
import { ScribeUserModel } from '../models/scribeUser.js';
import { ScribeSectionTemplateModel } from '../models/scribeSectionTemplate.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/templates', scribeTemplatesRouter);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe Templates Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();
    const userModel = new ScribeUserModel();
    const user = await userModel.create({ email: 'tmpl-route@test.com', passwordHash: 'hash' });
    await new ScribeSectionTemplateModel().seedPrebuilt();
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(async () => { await closePool(); });

  it('GET / — returns prebuilt + user templates', async () => {
    const res = await request(app).get('/api/scribe/templates').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  it('GET /prebuilt — returns only prebuilt sections', async () => {
    const res = await request(app).get('/api/scribe/templates/prebuilt').set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.templates.every((t: any) => t.is_prebuilt === 1 || t.is_prebuilt === true)).toBe(true);
  });

  it('POST / — creates custom section', async () => {
    const res = await request(app)
      .post('/api/scribe/templates')
      .set('Cookie', authCookie)
      .send({ name: 'My Custom Section', promptHint: 'Custom hint' });
    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('My Custom Section');
    expect(res.body.template.is_prebuilt === 0 || res.body.template.is_prebuilt === false).toBe(true);
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
