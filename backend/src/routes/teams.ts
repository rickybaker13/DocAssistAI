import { Router, Request, Response } from 'express';
import { TeamModel, TeamRole } from '../models/team.js';

const router = Router();
const teamModel = new TeamModel();

const VALID_ROLES: TeamRole[] = ['admin', 'lead', 'member'];

// ---------------------------------------------------------------------------
// GET /  — list teams for the authenticated user
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const teams = await teamModel.listTeamsForUser(req.scribeUserId!);
    res.json({ teams });
  } catch (err: any) {
    console.error('GET /api/teams error:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// ---------------------------------------------------------------------------
// POST /  — create a new team (caller becomes admin)
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, specialty, settings } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const team = await teamModel.create({
      name: name.trim(),
      specialty: specialty ?? undefined,
      settings: settings ?? undefined,
      createdBy: req.scribeUserId!,
    });
    res.status(201).json({ team, role: 'admin' });
  } catch (err: any) {
    console.error('POST /api/teams error:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId  — get team details (members only)
// ---------------------------------------------------------------------------
router.get('/:teamId', async (req: Request, res: Response) => {
  try {
    const membership = await teamModel.getMembership(req.params.teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }
    const team = await teamModel.findById(req.params.teamId);
    if (!team) {
      res.status(404).json({ error: 'Team not found' });
      return;
    }
    res.json({ team, role: membership.role });
  } catch (err: any) {
    console.error('GET /api/teams/:teamId error:', err);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:teamId  — update team (admin only)
// ---------------------------------------------------------------------------
router.patch('/:teamId', async (req: Request, res: Response) => {
  try {
    const { name, specialty, settings } = req.body;
    const team = await teamModel.update(req.params.teamId, req.scribeUserId!, {
      name, specialty, settings,
    });
    if (!team) {
      res.status(403).json({ error: 'Not authorized to update this team' });
      return;
    }
    res.json({ team });
  } catch (err: any) {
    console.error('PATCH /api/teams/:teamId error:', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:teamId  — delete team (admin only)
// ---------------------------------------------------------------------------
router.delete('/:teamId', async (req: Request, res: Response) => {
  try {
    const deleted = await teamModel.delete(req.params.teamId, req.scribeUserId!);
    if (!deleted) {
      res.status(403).json({ error: 'Not authorized to delete this team' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/teams/:teamId error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/members  — list team members
// ---------------------------------------------------------------------------
router.get('/:teamId/members', async (req: Request, res: Response) => {
  try {
    const membership = await teamModel.getMembership(req.params.teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }
    const members = await teamModel.listMembers(req.params.teamId);

    // Members see limited info; leads/admins see full details
    if (membership.role === 'member') {
      const sanitized = members.map(m => ({
        user_id: m.user_id,
        name: m.name,
        role: m.role,
        joined_at: m.joined_at,
      }));
      res.json({ members: sanitized });
      return;
    }

    res.json({ members });
  } catch (err: any) {
    console.error('GET /api/teams/:teamId/members error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:teamId/members/:userId  — update member role (admin only)
// ---------------------------------------------------------------------------
router.patch('/:teamId/members/:userId', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    const updated = await teamModel.updateMemberRole(
      req.params.teamId, req.params.userId, role, req.scribeUserId!,
    );
    if (!updated) {
      res.status(403).json({ error: 'Not authorized or member not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('PATCH /api/teams/:teamId/members/:userId error:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:teamId/members/:userId  — remove member (admin, or self-leave)
// ---------------------------------------------------------------------------
router.delete('/:teamId/members/:userId', async (req: Request, res: Response) => {
  try {
    const removed = await teamModel.removeMember(
      req.params.teamId, req.params.userId, req.scribeUserId!,
    );
    if (!removed) {
      res.status(403).json({ error: 'Not authorized or member not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/teams/:teamId/members/:userId error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ---------------------------------------------------------------------------
// POST /:teamId/invites  — create invite token (admin/lead)
// ---------------------------------------------------------------------------
router.post('/:teamId/invites', async (req: Request, res: Response) => {
  try {
    const { role, maxUses, expiresInHours } = req.body;
    if (role && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }
    const invite = await teamModel.createInvite({
      teamId: req.params.teamId,
      createdBy: req.scribeUserId!,
      role,
      maxUses,
      expiresInHours,
    });
    res.status(201).json({ invite });
  } catch (err: any) {
    if (err.message?.includes('Only admins') || err.message?.includes('Leads can only')) {
      res.status(403).json({ error: err.message });
      return;
    }
    console.error('POST /api/teams/:teamId/invites error:', err);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/invites  — list invites (admin/lead)
// ---------------------------------------------------------------------------
router.get('/:teamId/invites', async (req: Request, res: Response) => {
  try {
    const membership = await teamModel.getMembership(req.params.teamId, req.scribeUserId!);
    if (!membership || membership.role === 'member') {
      res.status(403).json({ error: 'Not authorized to view invites' });
      return;
    }
    const invites = await teamModel.listInvites(req.params.teamId);
    res.json({ invites });
  } catch (err: any) {
    console.error('GET /api/teams/:teamId/invites error:', err);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:teamId/invites/:inviteId  — revoke invite (admin/lead)
// ---------------------------------------------------------------------------
router.delete('/:teamId/invites/:inviteId', async (req: Request, res: Response) => {
  try {
    const revoked = await teamModel.revokeInvite(req.params.inviteId, req.scribeUserId!);
    if (!revoked) {
      res.status(403).json({ error: 'Not authorized or invite not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/teams/:teamId/invites/:inviteId error:', err);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// ---------------------------------------------------------------------------
// POST /join  — redeem an invite token (any authenticated user)
// ---------------------------------------------------------------------------
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'token is required' });
      return;
    }
    const result = await teamModel.redeemInvite(token.trim(), req.scribeUserId!);
    if ('error' in result) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ team: result.team, role: result.role });
  } catch (err: any) {
    console.error('POST /api/teams/join error:', err);
    res.status(500).json({ error: 'Failed to join team' });
  }
});

export default router;
