import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingUsageModel } from '../models/codingUsage.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import coderSessionsRouter from './coderSessions.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/coder/sessions', scribeAuthMiddleware, coderSessionsRouter);

const SECRET = 'test-secret';
const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const usageModel = new CodingUsageModel();

let coderUserId: string;
let otherCoderUserId: string;
let clinicianUserId: string;
let teamId: string;
let coderCookie: string;
let otherCoderCookie: string;
let clinicianCookie: string;
let createdSessionId: string;

const SESSION_PAYLOAD = {
  patientName: 'John Doe',
  mrn: 'MRN-12345',
  dateOfService: '2026-03-15',
  providerName: 'Dr. Smith',
  facility: 'City Hospital',
  noteType: 'progress_note',
  icd10Codes: [{ code: 'E11.9', description: 'Type 2 diabetes' }],
  cptCodes: [{ code: '99213', description: 'Office visit' }],
  emLevel: { suggested: '99213', mdm_complexity: 'Moderate' },
  missingDocumentation: ['HbA1c value'],
};

describe('Coder Sessions Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    const pool = getPool();

    // Create a team first
    const managerUser = await userModel.create({ email: 'sess-mgr@test.com', passwordHash: 'hash' });
    const team = await teamModel.create({ name: 'Session Test Team', managerUserId: managerUser.id });
    teamId = team.id;

    // Create billing coder assigned to team
    const coder = await userModel.create({ email: 'sess-coder@test.com', passwordHash: 'hash' });
    coderUserId = coder.id;
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`,
      [teamId, coderUserId],
    );

    // Create another billing coder on a different team
    const otherCoder = await userModel.create({ email: 'sess-other-coder@test.com', passwordHash: 'hash' });
    otherCoderUserId = otherCoder.id;
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = NULL WHERE id = $1`,
      [otherCoderUserId],
    );

    // Create a clinician (no coder role)
    const clinician = await userModel.create({ email: 'sess-clinician@test.com', passwordHash: 'hash' });
    clinicianUserId = clinician.id;

    coderCookie = `scribe_token=${jwt.sign({ userId: coderUserId }, SECRET, { expiresIn: '1h' })}`;
    otherCoderCookie = `scribe_token=${jwt.sign({ userId: otherCoderUserId }, SECRET, { expiresIn: '1h' })}`;
    clinicianCookie = `scribe_token=${jwt.sign({ userId: clinicianUserId }, SECRET, { expiresIn: '1h' })}`;
  });

  afterAll(async () => {
    await closePool();
  });

  // ── POST / — Create session ───────────────────────────────────────────────

  it('POST / — saves session, returns created record with id', async () => {
    const res = await request(app)
      .post('/api/scribe/coder/sessions')
      .set('Cookie', coderCookie)
      .send(SESSION_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toBeDefined();
    expect(res.body.session.patient_name).toBe('John Doe');
    expect(res.body.session.mrn).toBe('MRN-12345');
    expect(res.body.session.provider_name).toBe('Dr. Smith');
    expect(res.body.session.note_type).toBe('progress_note');
    expect(res.body.session.coder_status).toBe('coded');
    expect(res.body.session.team_id).toBe(teamId);
    expect(res.body.session.coder_user_id).toBe(coderUserId);

    createdSessionId = res.body.session.id;
  });

  it('POST / — increments usage counter', async () => {
    const usage = await usageModel.getForMonth(teamId);
    expect(usage).not.toBeNull();
    expect(usage!.notes_coded).toBeGreaterThanOrEqual(1);
  });

  // ── GET / — List sessions ─────────────────────────────────────────────────

  it('GET / — lists coder\'s own sessions', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/sessions')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBeGreaterThanOrEqual(1);
    expect(res.body.sessions[0].coder_user_id).toBe(coderUserId);
  });

  // ── GET /:id — Get single session ─────────────────────────────────────────

  it('GET /:id — returns single session', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/sessions/${createdSessionId}`)
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.body.session.id).toBe(createdSessionId);
    expect(res.body.session.patient_name).toBe('John Doe');
  });

  it('GET /:id — 403 for another coder\'s session', async () => {
    // Give otherCoder a team so they pass role check but don't own this session
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users SET coding_team_id = $1 WHERE id = $2`,
      [teamId, otherCoderUserId],
    );

    const res = await request(app)
      .get(`/api/scribe/coder/sessions/${createdSessionId}`)
      .set('Cookie', otherCoderCookie);

    expect(res.status).toBe(403);

    // Reset
    await pool.query(
      `UPDATE scribe_users SET coding_team_id = NULL WHERE id = $1`,
      [otherCoderUserId],
    );
  });

  // ── PATCH /:id — Update status ────────────────────────────────────────────

  it('PATCH /:id — updates status to reviewed', async () => {
    const res = await request(app)
      .patch(`/api/scribe/coder/sessions/${createdSessionId}`)
      .set('Cookie', coderCookie)
      .send({ coderStatus: 'reviewed' });

    expect(res.status).toBe(200);
    expect(res.body.session.coder_status).toBe('reviewed');
  });

  // ── DELETE /:id — Delete session ──────────────────────────────────────────

  it('DELETE /:id — deletes session, returns 204', async () => {
    const res = await request(app)
      .delete(`/api/scribe/coder/sessions/${createdSessionId}`)
      .set('Cookie', coderCookie);

    expect(res.status).toBe(204);
  });

  // ── 403 for clinician role ────────────────────────────────────────────────

  it('403 for clinician role on all endpoints', async () => {
    const post = await request(app)
      .post('/api/scribe/coder/sessions')
      .set('Cookie', clinicianCookie)
      .send(SESSION_PAYLOAD);
    expect(post.status).toBe(403);

    const get = await request(app)
      .get('/api/scribe/coder/sessions')
      .set('Cookie', clinicianCookie);
    expect(get.status).toBe(403);

    const getOne = await request(app)
      .get('/api/scribe/coder/sessions/fake-id')
      .set('Cookie', clinicianCookie);
    expect(getOne.status).toBe(403);

    const patch = await request(app)
      .patch('/api/scribe/coder/sessions/fake-id')
      .set('Cookie', clinicianCookie)
      .send({ coderStatus: 'reviewed' });
    expect(patch.status).toBe(403);

    const del = await request(app)
      .delete('/api/scribe/coder/sessions/fake-id')
      .set('Cookie', clinicianCookie);
    expect(del.status).toBe(403);
  });
});
