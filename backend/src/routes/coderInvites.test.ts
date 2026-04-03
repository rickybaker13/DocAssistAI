import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingTeamMemberModel } from '../models/codingTeamMember.js';
import { initPool, getPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import coderInvitesRouter from './coderInvites.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/coder/invites', coderInvitesRouter);

const SECRET = 'test-secret';
const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const memberModel = new CodingTeamMemberModel();

let managerUserId: string;
let coderUserId: string;
let teamId: string;
let memberId: string;
const inviteToken = 'test-invite-token-abc123';

describe('Coder Invites Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();

    // Create manager and team
    const managerUser = await userModel.create({ email: 'invite-mgr@test.com', passwordHash: 'hash' });
    managerUserId = managerUser.id;

    const team = await teamModel.create({ name: 'Invite Test Team', managerUserId });
    teamId = team.id;

    // Create a stub coder user (like the invite endpoint does)
    const coderUser = await userModel.create({ email: 'invite-coder@test.com', passwordHash: 'pending-invite' });
    coderUserId = coderUser.id;

    const pool = getPool();
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1 WHERE id = $2`,
      [teamId, coderUserId],
    );

    // Create pending member with invite token
    const member = await memberModel.create({
      teamId,
      userId: coderUserId,
      role: 'coder',
      invitedBy: managerUserId,
    });
    memberId = member.id;

    await pool.query('UPDATE coding_team_members SET invite_token = $1 WHERE id = $2', [inviteToken, memberId]);
  });

  afterAll(async () => {
    await closePool();
  });

  // ── GET /:token — Validate invite ───────────────────────────────────────

  it('GET /:token — returns team info for valid pending invite', async () => {
    const res = await request(app).get(`/api/scribe/coder/invites/${inviteToken}`);

    expect(res.status).toBe(200);
    expect(res.body.teamName).toBe('Invite Test Team');
    expect(res.body.email).toBe('invite-coder@test.com');
    expect(typeof res.body.hasPassword).toBe('boolean');
  });

  it('GET /:token — returns 404 for invalid token', async () => {
    const res = await request(app).get('/api/scribe/coder/invites/nonexistent-token');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });

  // ── POST /:token/accept — Accept invite ─────────────────────────────────

  it('POST /:token/accept — returns 400 for short password', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/invites/${inviteToken}/accept`)
      .send({ password: 'short', name: 'Test Coder' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  it('POST /:token/accept — sets password, activates member, returns JWT cookie', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/invites/${inviteToken}/accept`)
      .send({ password: 'securepassword123', name: 'Test Coder' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.userId).toBe(coderUserId);

    // Check cookie was set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/scribe_token=/);

    // Verify user was updated
    const user = await userModel.findById(coderUserId);
    expect(user!.name).toBe('Test Coder');
    expect(user!.subscription_status).toBe('active');
    expect(user!.password_hash).not.toBe('pending-invite');

    // Verify member was activated
    const member = await memberModel.findById(memberId);
    expect(member!.status).toBe('active');
    expect(member!.accepted_at).not.toBeNull();
  });

  it('POST /:token/accept — clears invite_token after acceptance', async () => {
    const pool = getPool();
    const result = await pool.query('SELECT invite_token FROM coding_team_members WHERE id = $1', [memberId]);
    expect(result.rows[0].invite_token).toBeNull();
  });

  it('POST /:token/accept — returns 404 for already-accepted invite', async () => {
    const res = await request(app)
      .post(`/api/scribe/coder/invites/${inviteToken}/accept`)
      .send({ password: 'securepassword123', name: 'Test Coder' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/invalid|expired/i);
  });
});
