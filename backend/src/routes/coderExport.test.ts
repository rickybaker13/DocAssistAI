import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingSessionModel } from '../models/codingSession.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import coderExportRouter from './coderExport.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/coder/export', scribeAuthMiddleware, coderExportRouter);

const SECRET = 'test-secret';
const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const sessionModel = new CodingSessionModel();

let coderUserId: string;
let managerUserId: string;
let clinicianUserId: string;
let teamId: string;
let coderCookie: string;
let managerCookie: string;
let clinicianCookie: string;

describe('Coder Export Route', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    const pool = getPool();

    // Create manager + team
    const mgr = await userModel.create({ email: 'export-mgr@test.com', passwordHash: 'hash' });
    managerUserId = mgr.id;
    const team = await teamModel.create({ name: 'Export Test Team', managerUserId: mgr.id });
    teamId = team.id;
    await pool.query(
      `UPDATE scribe_users SET user_role = 'coding_manager', coding_team_id = $1 WHERE id = $2`,
      [teamId, managerUserId],
    );

    // Create billing coder assigned to team
    const coder = await userModel.create({ email: 'export-coder@test.com', passwordHash: 'hash' });
    coderUserId = coder.id;
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`,
      [teamId, coderUserId],
    );

    // Create clinician (no coder role)
    const clinician = await userModel.create({ email: 'export-clinician@test.com', passwordHash: 'hash' });
    clinicianUserId = clinician.id;

    coderCookie = `scribe_token=${jwt.sign({ userId: coderUserId }, SECRET, { expiresIn: '1h' })}`;
    managerCookie = `scribe_token=${jwt.sign({ userId: managerUserId }, SECRET, { expiresIn: '1h' })}`;
    clinicianCookie = `scribe_token=${jwt.sign({ userId: clinicianUserId }, SECRET, { expiresIn: '1h' })}`;

    // Seed a coding session
    await sessionModel.create({
      coderUserId,
      teamId,
      patientName: 'Export Patient',
      mrn: 'MRN-EXP-1',
      dateOfService: '2026-03-15',
      providerName: 'Dr. Export',
      facility: 'Test Clinic',
      noteType: 'progress_note',
      icd10Codes: [
        { code: 'E11.9', description: 'Type 2 diabetes', confidence: 0.95 },
        { code: 'I10', description: 'Hypertension', confidence: 0.88 },
      ],
      cptCodes: [{ code: '99213', description: 'Office visit', confidence: 0.92 }],
      emLevel: { suggested: '99213', mdm_complexity: 'Moderate' },
      missingDocumentation: ['HbA1c value', 'BP reading'],
    });
  });

  afterAll(async () => {
    await closePool();
  });

  it('returns 400 without start/end params', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export')
      .set('Cookie', coderCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/start and end/i);
  });

  it('returns xlsx with correct content-type header', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=xlsx')
      .set('Cookie', coderCookie)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.headers['content-disposition']).toMatch(/coding-export-2026-03-01-to-2026-04-30\.xlsx/);
  });

  it('returns csv when format=csv', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=csv')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/csv/);
    expect(res.headers['content-disposition']).toMatch(/coding-export.*\.csv/);
  });

  it('returns 403 for clinician role', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30')
      .set('Cookie', clinicianCookie);
    expect(res.status).toBe(403);
  });

  it('contains data (response body is non-empty binary)', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=xlsx')
      .set('Cookie', coderCookie)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    // xlsx files are ZIP archives — minimum size is well over 100 bytes
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('manager can export team sessions as xlsx', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-04-30&format=xlsx')
      .set('Cookie', managerCookie)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(res.body.length).toBeGreaterThan(100);
  });
});
