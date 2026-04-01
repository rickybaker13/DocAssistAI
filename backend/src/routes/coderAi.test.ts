import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
import { aiService } from '../services/ai/aiService.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import coderAiRouter from './coderAi.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe/coder', scribeAuthMiddleware, coderAiRouter);

const SECRET = 'test-secret';
let coderCookie: string;
let managerCookie: string;
let clinicianCookie: string;
let mockAiChat: ReturnType<typeof jest.spyOn>;
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;

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

describe('Coder AI Routes — POST /extract-codes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    const userModel = new ScribeUserModel();
    const teamModel = new CodingTeamModel();

    // Create test users
    const manager = await userModel.create({ email: 'coder-mgr@test.com', passwordHash: 'hash' });
    const coder = await userModel.create({ email: 'coder-user@test.com', passwordHash: 'hash' });
    const clinician = await userModel.create({ email: 'coder-clinician@test.com', passwordHash: 'hash' });

    // Create team with manager
    const team = await teamModel.create({ name: 'Test Coding Team', managerUserId: manager.id });

    // Set roles via direct SQL
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users SET user_role = 'coding_manager', coding_team_id = $1 WHERE id = $2`,
      [team.id, manager.id],
    );
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`,
      [team.id, coder.id],
    );
    // clinician stays as default 'clinician' role

    // Generate JWT cookies
    managerCookie = `scribe_token=${jwt.sign({ userId: manager.id }, SECRET, { expiresIn: '1h' })}`;
    coderCookie = `scribe_token=${jwt.sign({ userId: coder.id }, SECRET, { expiresIn: '1h' })}`;
    clinicianCookie = `scribe_token=${jwt.sign({ userId: clinician.id }, SECRET, { expiresIn: '1h' })}`;

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

  it('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .send({ noteText: 'Patient has diabetes.' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for clinician role', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', clinicianCookie)
      .send({ noteText: 'Patient has diabetes.' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
  });

  it('returns 400 if noteText is missing', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/noteText/i);
  });

  it('returns 400 if noteText is empty string', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: '   ' });
    expect(res.status).toBe(400);
  });

  it('extracts codes for billing_coder role', async () => {
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has Type 2 diabetes mellitus.' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.icd10_codes)).toBe(true);
    expect(res.body.icd10_codes[0].code).toBe('E11.9');
    expect(Array.isArray(res.body.cpt_codes)).toBe(true);
    expect(res.body.em_level).toBeDefined();
    expect(res.body.disclaimer).toBeDefined();
  });

  it('extracts codes for coding_manager role', async () => {
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', managerCookie)
      .send({ noteText: 'Patient has Type 2 diabetes mellitus.' });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.icd10_codes)).toBe(true);
    expect(res.body.disclaimer).toBeDefined();
  });

  it('calls piiScrubber.scrub before AI call', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { noteText: '[PERSON_0] has diabetes.' },
      subMap: { '[PERSON_0]': 'John Smith' },
    });
    mockReInject.mockImplementation((text) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'John Smith has diabetes.' });

    expect(res.status).toBe(200);
    expect(mockScrub).toHaveBeenCalledWith(
      expect.objectContaining({ noteText: 'John Smith has diabetes.' }),
    );
    // Verify the AI received scrubbed text
    const userMsg: string =
      (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'user')?.content ?? '';
    expect(userMsg).toContain('[PERSON_0]');
    expect(userMsg).not.toContain('John Smith');
  });

  it('returns 503 if PII service is unavailable', async () => {
    mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has diabetes.' });

    expect(res.status).toBe(503);
    expect(mockAiChat).not.toHaveBeenCalled();
    expect(res.body.error).toMatch(/PII scrubbing/i);
  });

  it('handles malformed AI JSON gracefully', async () => {
    mockAiChat.mockResolvedValueOnce({ content: 'This is not JSON at all.' } as any);

    const res = await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has diabetes.' });

    expect(res.status).toBe(200);
    expect(res.body.icd10_codes).toEqual([]);
    expect(res.body.cpt_codes).toEqual([]);
    expect(res.body.em_level).toBeNull();
    expect(res.body.missing_documentation).toEqual([]);
    expect(res.body.disclaimer).toBeDefined();
  });

  it('includes TOKEN_PRESERVATION_INSTRUCTION in system prompt', async () => {
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has diabetes.' });

    const sys: string =
      (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
    expect(sys).toMatch(/privacy-protection token|TOKEN_N|BRACKET_N/i);
  });

  it('uses temperature 0.2 for the AI call', async () => {
    mockAiChat.mockResolvedValueOnce({ content: VALID_AI_RESPONSE } as any);

    await request(app)
      .post('/api/ai/scribe/coder/extract-codes')
      .set('Cookie', coderCookie)
      .send({ noteText: 'Patient has diabetes.' });

    const callArgs = mockAiChat.mock.calls[0][0] as any;
    expect(callArgs.options.temperature).toBe(0.2);
  });
});
