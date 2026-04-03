import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingTeamModel } from '../models/codingTeam.js';
import { CodingTeamMemberModel } from '../models/codingTeamMember.js';
import { CodingUsageModel } from '../models/codingUsage.js';
import { getPool } from '../database/db.js';
import { emailService } from '../services/email/emailService.js';

const router = Router();
const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const memberModel = new CodingTeamMemberModel();
const usageModel = new CodingUsageModel();

// ─── POST / — Create a team ────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user) {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }
  // Allow first-time setup: clinician with no team can create one
  if (user.user_role !== 'coding_manager' && user.user_role !== 'clinician') {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }
  if (user.coding_team_id) {
    return res.status(400).json({ error: 'User already belongs to a team' }) as any;
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' }) as any;
  }

  const team = await teamModel.create({ name: name.trim(), managerUserId: user.id });

  // Create manager as first member
  const rawMember = await memberModel.create({
    teamId: team.id,
    userId: user.id,
    role: 'manager',
    invitedBy: user.id,
  });
  const member = await memberModel.activate(rawMember.id);

  // Upgrade user role and link team
  const pool = getPool();
  await pool.query(
    `UPDATE scribe_users SET user_role = 'coding_manager', coding_team_id = $1, updated_at = NOW() WHERE id = $2`,
    [team.id, user.id],
  );

  return res.status(201).json({ team, member }) as any;
});

// ─── GET /:id — Get team details + member list ─────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || user.user_role !== 'coding_manager') {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }

  const team = await teamModel.findById(req.params.id);
  if (!team || team.manager_user_id !== user.id) {
    return res.status(403).json({ error: 'Not authorized for this team' }) as any;
  }

  const members = await memberModel.listByTeam(team.id);
  return res.json({ team, members }) as any;
});

// ─── POST /:id/invite — Invite a coder ─────────────────────────────────────
router.post('/:id/invite', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || user.user_role !== 'coding_manager') {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }

  const team = await teamModel.findById(req.params.id);
  if (!team || team.manager_user_id !== user.id) {
    return res.status(403).json({ error: 'Not authorized for this team' }) as any;
  }

  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' }) as any;
  }

  // Check seat limit: count active + pending members
  const pool = getPool();
  const seatResult = await pool.query(
    `SELECT COUNT(*) as count FROM coding_team_members WHERE team_id = $1 AND status IN ('active', 'pending')`,
    [team.id],
  );
  const occupiedSeats = parseInt(seatResult.rows[0].count, 10);
  if (occupiedSeats >= team.included_seats) {
    return res.status(400).json({ error: 'Seat limit reached' }) as any;
  }

  // Find or create user
  let invitee = await userModel.findByEmail(email.trim());
  if (!invitee) {
    invitee = await userModel.create({ email: email.trim(), passwordHash: 'pending-invite' });
    await pool.query(
      `UPDATE scribe_users SET user_role = 'billing_coder', coding_team_id = $1, updated_at = NOW() WHERE id = $2`,
      [team.id, invitee.id],
    );
  }

  const member = await memberModel.create({
    teamId: team.id,
    userId: invitee.id,
    role: 'coder',
    invitedBy: user.id,
  });

  // Generate invite token, store it, and send email
  const inviteToken = randomBytes(24).toString('base64url');
  await pool.query('UPDATE coding_team_members SET invite_token = $1 WHERE id = $2', [inviteToken, member.id]);

  await emailService.sendCoderInviteEmail(email.trim(), user.name || user.email, team.name, inviteToken);

  return res.status(201).json({ member: { ...member, invite_token: inviteToken } }) as any;
});

// ─── PATCH /:id/members/:memberId — Activate/deactivate member ─────────────
router.patch('/:id/members/:memberId', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || user.user_role !== 'coding_manager') {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }

  const team = await teamModel.findById(req.params.id);
  if (!team || team.manager_user_id !== user.id) {
    return res.status(403).json({ error: 'Not authorized for this team' }) as any;
  }

  const { action } = req.body;
  if (action !== 'activate' && action !== 'deactivate') {
    return res.status(400).json({ error: 'action must be "activate" or "deactivate"' }) as any;
  }

  const member = await memberModel.findById(req.params.memberId);
  if (!member || member.team_id !== team.id) {
    return res.status(404).json({ error: 'Member not found' }) as any;
  }

  const updated = action === 'activate'
    ? await memberModel.activate(member.id)
    : await memberModel.deactivate(member.id);

  return res.json({ member: updated }) as any;
});

// ─── GET /:id/usage — Get usage stats ───────────────────────────────────────
router.get('/:id/usage', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || user.user_role !== 'coding_manager') {
    return res.status(403).json({ error: 'Coding manager role required' }) as any;
  }

  const team = await teamModel.findById(req.params.id);
  if (!team || team.manager_user_id !== user.id) {
    return res.status(403).json({ error: 'Not authorized for this team' }) as any;
  }

  const current = await usageModel.getForMonth(team.id);
  const history = await usageModel.getHistory(team.id, 12);

  return res.json({ current, history }) as any;
});

export default router;
