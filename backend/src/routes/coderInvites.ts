import { Router, Request, Response } from 'express';
import { getPool } from '../database/db.js';
import { CodingTeamMemberModel } from '../models/codingTeamMember.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const memberModel = new CodingTeamMemberModel();

// GET /:token — validate invite and return team info
router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  const pool = getPool();

  const result = await pool.query(
    `SELECT ctm.*, ct.name as team_name, su.email, su.name as user_name
     FROM coding_team_members ctm
     JOIN coding_teams ct ON ct.id = ctm.team_id
     JOIN scribe_users su ON su.id = ctm.user_id
     WHERE ctm.invite_token = $1 AND ctm.status = 'pending'`,
    [token],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid or expired invite' }) as any;
  }

  const invite = result.rows[0];
  return res.json({
    teamName: invite.team_name,
    email: invite.email,
    hasPassword: invite.user_name !== null,
  });
});

// POST /:token/accept — accept invite + set password
router.post('/:token/accept', async (req: Request, res: Response) => {
  const { token } = req.params;
  const { password, name } = req.body;

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' }) as any;
  }

  const pool = getPool();

  // Find the pending invite
  const result = await pool.query(
    `SELECT ctm.*, su.email
     FROM coding_team_members ctm
     JOIN scribe_users su ON su.id = ctm.user_id
     WHERE ctm.invite_token = $1 AND ctm.status = 'pending'`,
    [token],
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid or expired invite' }) as any;
  }

  const invite = result.rows[0];

  // Hash password and update user
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `UPDATE scribe_users SET password_hash = $1, name = $2, subscription_status = 'active' WHERE id = $3`,
    [passwordHash, name || null, invite.user_id],
  );

  // Activate the membership
  await memberModel.activate(invite.id);

  // Clear the invite token (one-time use)
  await pool.query('UPDATE coding_team_members SET invite_token = NULL WHERE id = $1', [invite.id]);

  // Generate JWT and set cookie (log them in)
  const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  const jwtToken = jwt.sign({ userId: invite.user_id }, secret, { expiresIn: '7d' });

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('scribe_token', jwtToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return res.json({ success: true, userId: invite.user_id });
});

export default router;
