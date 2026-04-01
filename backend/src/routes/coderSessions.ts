import { Router, Request, Response } from 'express';
import { ScribeUserModel } from '../models/scribeUser.js';
import { CodingSessionModel } from '../models/codingSession.js';
import { CodingUsageModel } from '../models/codingUsage.js';
import { CodingTeamModel } from '../models/codingTeam.js';

const router = Router();
const userModel = new ScribeUserModel();
const sessionModel = new CodingSessionModel();
const usageModel = new CodingUsageModel();
const teamModel = new CodingTeamModel();

// ─── GET / — List sessions ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  if (user.user_role === 'coding_manager' && req.query.teamId) {
    // Team-wide view for managers
    const teamId = req.query.teamId as string;
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const sessions = await sessionModel.listByTeam(teamId, { start, end });
    return res.json({ sessions }) as any;
  }

  // Default: own sessions
  const sessions = await sessionModel.listByCoder(user.id, { limit, offset });
  return res.json({ sessions }) as any;
});

// ─── GET /:id — Get single session ─────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  const session = await sessionModel.findById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' }) as any;
  }

  // Ownership check: coder owns it OR manager of the same team
  const isOwner = session.coder_user_id === user.id;
  const isTeamManager = user.user_role === 'coding_manager' && session.team_id === user.coding_team_id;
  if (!isOwner && !isTeamManager) {
    return res.status(403).json({ error: 'Not authorized to view this session' }) as any;
  }

  return res.json({ session }) as any;
});

// ─── POST / — Save a new coding session ────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  const { patientName, mrn, dateOfService, providerName, facility, noteType, icd10Codes, cptCodes, emLevel, missingDocumentation } = req.body;

  if (!patientName || !dateOfService || !providerName || !noteType) {
    return res.status(400).json({ error: 'patientName, dateOfService, providerName, and noteType are required' }) as any;
  }

  if (!user.coding_team_id) {
    return res.status(400).json({ error: 'User is not assigned to a coding team' }) as any;
  }

  const session = await sessionModel.create({
    coderUserId: user.id,
    teamId: user.coding_team_id,
    patientName,
    mrn,
    dateOfService,
    providerName,
    facility,
    noteType,
    icd10Codes,
    cptCodes,
    emLevel,
    missingDocumentation,
  });

  // Increment usage counter
  const team = await teamModel.findById(user.coding_team_id);
  if (team) {
    await usageModel.increment(team.id, team.included_notes);
  }

  return res.status(201).json({ session }) as any;
});

// ─── PATCH /:id — Update session status ────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  const session = await sessionModel.findById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' }) as any;
  }

  const isOwner = session.coder_user_id === user.id;
  const isTeamManager = user.user_role === 'coding_manager' && session.team_id === user.coding_team_id;
  if (!isOwner && !isTeamManager) {
    return res.status(403).json({ error: 'Not authorized to update this session' }) as any;
  }

  const { coderStatus } = req.body;
  const validStatuses = ['coded', 'reviewed', 'flagged'];
  if (!coderStatus || !validStatuses.includes(coderStatus)) {
    return res.status(400).json({ error: `coderStatus must be one of: ${validStatuses.join(', ')}` }) as any;
  }

  const updated = await sessionModel.updateStatus(session.id, coderStatus);
  return res.json({ session: updated }) as any;
});

// ─── DELETE /:id — Delete session ──────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user || (user.user_role !== 'billing_coder' && user.user_role !== 'coding_manager')) {
    return res.status(403).json({ error: 'Billing coder or coding manager role required' }) as any;
  }

  const session = await sessionModel.findById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' }) as any;
  }

  const isOwner = session.coder_user_id === user.id;
  const isTeamManager = user.user_role === 'coding_manager' && session.team_id === user.coding_team_id;
  if (!isOwner && !isTeamManager) {
    return res.status(403).json({ error: 'Not authorized to delete this session' }) as any;
  }

  await sessionModel.deleteById(session.id);
  return res.status(204).send() as any;
});

export default router;
