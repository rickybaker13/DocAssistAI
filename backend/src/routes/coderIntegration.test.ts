import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { piiScrubber } from '../services/piiScrubber.js';
import { aiService } from '../services/ai/aiService.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import coderAiRouter from './coderAi.js';
import coderTeamsRouter from './coderTeams.js';
import coderSessionsRouter from './coderSessions.js';
import coderExportRouter from './coderExport.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe/coder', scribeAuthMiddleware, coderAiRouter);
app.use('/api/scribe/coder/teams', scribeAuthMiddleware, coderTeamsRouter);
app.use('/api/scribe/coder/sessions', scribeAuthMiddleware, coderSessionsRouter);
app.use('/api/scribe/coder/export', scribeAuthMiddleware, coderExportRouter);

const SECRET = 'test-secret';

const VALID_AI_RESPONSE = JSON.stringify({
  icd10_codes: [
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', confidence: 0.95, supporting_text: 'Patient has diabetes' },
  ],
  cpt_codes: [
    { code: '99223', description: 'Initial hospital care, high complexity', confidence: 0.90, reasoning: 'High complexity MDM' },
  ],
  em_level: {
    suggested: '99223',
    mdm_complexity: 'High',
    reasoning: 'Multiple acute problems',
  },
  missing_documentation: ['Document HbA1c level'],
});

let mockAiChat: ReturnType<typeof jest.spyOn>;
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;

describe('CodeAssist end-to-end integration', () => {
  let managerUserId: string;
  let managerCookie: string;
  let teamId: string;
  let coderMemberId: string;
  let coderUserId: string;
  let coderCookie: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    mockAiChat = jest.spyOn(aiService, 'chat');
    mockScrub = jest.spyOn(piiScrubber, 'scrub');
    mockReInject = jest.spyOn(piiScrubber, 'reInject');
  });

  beforeEach(() => {
    mockScrub.mockImplementation(async (fields) => ({
      scrubbedFields: { ...fields },
      subMap: {},
    }));
    mockReInject.mockImplementation((text) => text);
  });

  afterEach(() => {
    mockAiChat.mockReset();
    mockScrub.mockReset();
    mockReInject.mockReset();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await closePool();
  });

  // ── Step 1: Manager creates account and team ──────────────────────────────
  it('Step 1 — manager creates a team via POST /api/scribe/coder/teams', async () => {
    const userModel = new ScribeUserModel();
    const manager = await userModel.create({ email: 'integ-mgr@test.com', passwordHash: 'hash' });
    managerUserId = manager.id;
    managerCookie = `scribe_token=${jwt.sign({ userId: manager.id }, SECRET, { expiresIn: '1h' })}`;

    const res = await request(app)
      .post('/api/scribe/coder/teams')
      .set('Cookie', managerCookie)
      .send({ name: 'Integration Test Team' });

    expect(res.status).toBe(201);
    expect(res.body.team).toBeDefined();
    expect(res.body.team.name).toBe('Integration Test Team');
    teamId = res.body.team.id;
  });

  // ── Step 2: Manager invites a coder ────────────────────────────────────────
  it('Step 2 — manager invites coder via POST /api/scribe/coder/teams/:id/invite', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/teams/${teamId}/invite`)
      .set('Cookie', managerCookie)
      .send({ email: 'integ-coder@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.member).toBeDefined();
    expect(res.body.member.status).toBe('pending');
    coderMemberId = res.body.member.id;

    // Look up the created user to get their ID for JWT
    const userModel = new ScribeUserModel();
    const coderUser = await userModel.findByEmail('integ-coder@test.com');
    expect(coderUser).not.toBeNull();
    coderUserId = coderUser!.id;
    coderCookie = `scribe_token=${jwt.sign({ userId: coderUserId }, SECRET, { expiresIn: '1h' })}`;
  });

  // ── Step 3: Manager activates the coder member ─────────────────────────────
  it('Step 3 — manager activates coder via PATCH /api/scribe/coder/teams/:id/members/:mid', async () => {
    const res = await request(app)
      .patch(`/api/scribe/coder/teams/${teamId}/members/${coderMemberId}`)
      .set('Cookie', managerCookie)
      .send({ action: 'activate' });

    expect(res.status).toBe(200);
    expect(res.body.member.status).toBe('active');
  });

  // ── Step 4: Coder extracts codes ──────────────────────────────────────────
  it('Step 4 — coder extracts codes via POST /api/ai/scribe/coder/extract-codes', async () => {
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has Type 2 diabetes mellitus. High complexity MDM.' });

    expect(res.status).toBe(200);
    expect(res.body.icd10_codes).toHaveLength(1);
    expect(res.body.icd10_codes[0].code).toBe('E11.9');
    expect(res.body.cpt_codes).toHaveLength(1);
    expect(res.body.em_level.suggested).toBe('99223');
    expect(res.body.disclaimer).toBeDefined();
  });

  // ── Step 5: Coder saves session 1 ─────────────────────────────────────────
  it('Step 5 — coder saves first session via POST /api/scribe/coder/sessions', async () => {
    const res = await request(app)
      .post('/api/scribe/coder/sessions')
      .set('Cookie', coderCookie)
      .send({
        patientName: 'Jane Doe',
        mrn: 'MRN-001',
        dateOfService: '2026-03-25',
        providerName: 'Dr. Smith',
        facility: 'General Hospital',
        noteType: 'progress_note',
        icd10Codes: [{ code: 'E11.9', description: 'Type 2 DM', confidence: 0.95 }],
        cptCodes: [{ code: '99223', description: 'Initial hospital care', confidence: 0.90 }],
        emLevel: { suggested: '99223', mdm_complexity: 'High', reasoning: 'Multiple acute problems' },
        missingDocumentation: ['Document HbA1c level'],
      });

    expect(res.status).toBe(201);
    expect(res.body.session).toBeDefined();
    expect(res.body.session.patient_name).toBe('Jane Doe');
  });

  // ── Step 6: Coder extracts + saves a second session ───────────────────────
  it('Step 6 — coder extracts and saves a second session', async () => {
    // Extract codes for second note
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    const extractRes = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient presents with CHF exacerbation.' });

    expect(extractRes.status).toBe(200);

    // Save second session
    const saveRes = await request(app)
      .post('/api/scribe/coder/sessions')
      .set('Cookie', coderCookie)
      .send({
        patientName: 'John Smith',
        mrn: 'MRN-002',
        dateOfService: '2026-03-26',
        providerName: 'Dr. Jones',
        facility: 'General Hospital',
        noteType: 'h_and_p',
        icd10Codes: extractRes.body.icd10_codes,
        cptCodes: extractRes.body.cpt_codes,
        emLevel: extractRes.body.em_level,
        missingDocumentation: extractRes.body.missing_documentation,
      });

    expect(saveRes.status).toBe(201);
    expect(saveRes.body.session.patient_name).toBe('John Smith');
  });

  // ── Step 7: Coder lists their sessions — expect 2 ─────────────────────────
  it('Step 7 — coder lists sessions via GET /api/scribe/coder/sessions — verify 2 results', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/sessions')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
  });

  // ── Step 8: Coder exports xlsx ─────────────────────────────────────────────
  it('Step 8 — coder exports xlsx via GET /api/scribe/coder/export — verify 200 + content-type', async () => {
    const res = await request(app)
      .get('/api/scribe/coder/export?start=2026-03-01&end=2026-03-31')
      .set('Cookie', coderCookie);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml|officedocument/);
  });

  // ── Step 9: Manager views team sessions ────────────────────────────────────
  it('Step 9 — manager views team sessions via GET /api/scribe/coder/sessions?teamId=...', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/sessions?teamId=${teamId}`)
      .set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    // Verify sessions belong to the coder
    for (const s of res.body.sessions) {
      expect(s.team_id).toBe(teamId);
    }
  });

  // ── Step 10: Usage was incremented ─────────────────────────────────────────
  it('Step 10 — verify usage incremented via GET /api/scribe/coder/teams/:id/usage', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/teams/${teamId}/usage`)
      .set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.current).toBeDefined();
    expect(res.body.current.notes_coded).toBe(2);
  });
});
