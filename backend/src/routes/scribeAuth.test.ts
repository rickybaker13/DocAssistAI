import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import scribeAuthRouter from './scribeAuth.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/auth', scribeAuthRouter);

describe('Scribe Auth Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
    await initPool();
    await runMigrations();
  });
  afterAll(async () => { await closePool(); });

  it('POST /register — creates user, returns 201, sets cookie', async () => {
    const res = await request(app)
      .post('/api/scribe/auth/register')
      .send({ email: 'reg@test.com', password: 'password123', name: 'Reg User' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('reg@test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /register — rejects duplicate email with 409', async () => {
    await request(app).post('/api/scribe/auth/register').send({ email: 'dup@test.com', password: 'password123' });
    const res = await request(app).post('/api/scribe/auth/register').send({ email: 'dup@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('POST /register — rejects password shorter than 8 chars', async () => {
    const res = await request(app).post('/api/scribe/auth/register').send({ email: 'short@test.com', password: 'abc' });
    expect(res.status).toBe(400);
  });

  it('POST /register — rejects invalid email format', async () => {
    const res = await request(app).post('/api/scribe/auth/register').send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('POST /login — succeeds with correct credentials', async () => {
    await request(app).post('/api/scribe/auth/register').send({ email: 'login@test.com', password: 'goodpass1' });
    const res = await request(app).post('/api/scribe/auth/login').send({ email: 'login@test.com', password: 'goodpass1' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@test.com');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('POST /login — rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/scribe/auth/login').send({ email: 'login@test.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('POST /logout — returns 200 and clears cookie', async () => {
    const res = await request(app).post('/api/scribe/auth/logout');
    expect(res.status).toBe(200);
  });
});
