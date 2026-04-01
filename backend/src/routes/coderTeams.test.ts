import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import coderTeamsRouter from './coderTeams.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/coder/teams', scribeAuthMiddleware, coderTeamsRouter);

const SECRET = 'test-secret';
const userModel = new ScribeUserModel();

let managerUserId: string;
let clinicianUserId: string;
let managerCookie: string;
let clinicianCookie: string;
let teamId: string;

describe('Coder Teams Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    // Create users — manager starts as clinician (route upgrades them)
    const managerUser = await userModel.create({ email: 'team-mgr@test.com', passwordHash: 'hash' });
    managerUserId = managerUser.id;

    const clinicianUser = await userModel.create({ email: 'team-clinician@test.com', passwordHash: 'hash' });
    clinicianUserId = clinicianUser.id;

    managerCookie = `scribe_token=${jwt.sign({ userId: managerUserId }, SECRET, { expiresIn: '1h' })}`;
    clinicianCookie = `scribe_token=${jwt.sign({ userId: clinicianUserId }, SECRET, { expiresIn: '1h' })}`;
  });

  afterAll(async () => {
    await closePool();
  });

  // ── POST / — Create team ──────────────────────────────────────────────────

  it('POST / — creates team, returns team + manager member', async () => {
    const res = await request(app)
      .post('/api/scribe/coder/teams')
      .set('Cookie', managerCookie)
      .send({ name: 'My Coding Team' });

    expect(res.status).toBe(201);
    expect(res.body.team).toBeDefined();
    expect(res.body.team.name).toBe('My Coding Team');
    expect(res.body.team.manager_user_id).toBe(managerUserId);
    expect(res.body.member).toBeDefined();
    expect(res.body.member.role).toBe('manager');
    expect(res.body.member.status).toBe('active');

    teamId = res.body.team.id;

    // Verify user was upgraded to coding_manager
    const user = await userModel.findById(managerUserId);
    expect(user!.user_role).toBe('coding_manager');
    expect(user!.coding_team_id).toBe(teamId);
  });

  it('POST / — 403 for non-manager (clinician already in a team or wrong role)', async () => {
    // First set clinician to billing_coder role (not allowed to create teams)
    const pool = getPool();
    await pool.query(`UPDATE scribe_users SET user_role = 'billing_coder' WHERE id = $1`, [clinicianUserId]);

    const res = await request(app)
      .post('/api/scribe/coder/teams')
      .set('Cookie', clinicianCookie)
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(403);

    // Reset clinician back to default
    await pool.query(`UPDATE scribe_users SET user_role = 'clinician' WHERE id = $1`, [clinicianUserId]);
  });

  // ── GET /:id — Team details ───────────────────────────────────────────────

  it('GET /:id — returns team + members list', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/teams/${teamId}`)
      .set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    expect(res.body.team.id).toBe(teamId);
    expect(Array.isArray(res.body.members)).toBe(true);
    expect(res.body.members.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /:id — 403 for non-manager', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/teams/${teamId}`)
      .set('Cookie', clinicianCookie);

    expect(res.status).toBe(403);
  });

  // ── POST /:id/invite — Invite coder ──────────────────────────────────────

  it('POST /:id/invite — invites coder by email, creates pending member', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/teams/${teamId}/invite`)
      .set('Cookie', managerCookie)
      .send({ email: 'invited-coder@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.member).toBeDefined();
    expect(res.body.member.role).toBe('coder');
    expect(res.body.member.status).toBe('pending');
  });

  it('POST /:id/invite — 400 for missing email', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/teams/${teamId}/invite`)
      .set('Cookie', managerCookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  // ── PATCH /:id/members/:memberId — Activate/deactivate ───────────────────

  let pendingMemberId: string;

  it('PATCH /:id/members/:mid — activates a pending member', async () => {
    // Get members to find the pending coder
    const listRes = await request(app)
      .get(`/api/scribe/coder/teams/${teamId}`)
      .set('Cookie', managerCookie);

    const pendingMember = listRes.body.members.find(
      (m: any) => m.role === 'coder' && m.status === 'pending',
    );
    expect(pendingMember).toBeDefined();
    pendingMemberId = pendingMember.id;

    const res = await request(app)
      .patch(`/api/scribe/coder/teams/${teamId}/members/${pendingMemberId}`)
      .set('Cookie', managerCookie)
      .send({ action: 'activate' });

    expect(res.status).toBe(200);
    expect(res.body.member.status).toBe('active');
    expect(res.body.member.accepted_at).not.toBeNull();
  });

  it('PATCH /:id/members/:mid — deactivates an active member', async () => {
    const res = await request(app)
      .patch(`/api/scribe/coder/teams/${teamId}/members/${pendingMemberId}`)
      .set('Cookie', managerCookie)
      .send({ action: 'deactivate' });

    expect(res.status).toBe(200);
    expect(res.body.member.status).toBe('deactivated');
  });

  // ── GET /:id/usage — Usage stats ──────────────────────────────────────────

  it('GET /:id/usage — returns usage (initially zero)', async () => {
    const res = await request(app)
      .get(`/api/scribe/coder/teams/${teamId}/usage`)
      .set('Cookie', managerCookie);

    expect(res.status).toBe(200);
    // No usage recorded yet, current should be null
    expect(res.body.current).toBeNull();
    expect(Array.isArray(res.body.history)).toBe(true);
    expect(res.body.history.length).toBe(0);
  });
});
