import { Router, Request, Response } from 'express';
import { MetricEventModel, EVENT_TYPES } from '../models/metricEvent.js';
import { TeamModel } from '../models/team.js';

const router = Router();
const metricModel = new MetricEventModel();
const teamModel = new TeamModel();

// Middleware: verify team membership and attach role
async function requireTeamMember(req: Request, res: Response, next: () => void) {
  const teamId = req.params.teamId || (req.body as any)?.teamId;
  if (!teamId) {
    res.status(400).json({ error: 'teamId is required' });
    return;
  }
  const membership = await teamModel.getMembership(teamId, req.scribeUserId!);
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this team' });
    return;
  }
  (req as any).teamRole = membership.role;
  next();
}

// ---------------------------------------------------------------------------
// POST /log  — log a metric event
// ---------------------------------------------------------------------------
router.post('/log', async (req: Request, res: Response) => {
  try {
    const { teamId, eventType, noteId, metadata, eventDate } = req.body;
    if (!teamId || !eventType) {
      res.status(400).json({ error: 'teamId and eventType are required' });
      return;
    }

    const membership = await teamModel.getMembership(teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const event = await metricModel.log({
      teamId,
      userId: req.scribeUserId!,
      eventType,
      noteId,
      metadata,
      eventDate,
    });
    res.status(201).json({ event });
  } catch (err: any) {
    console.error('POST /api/metrics/log error:', err);
    res.status(500).json({ error: 'Failed to log metric event' });
  }
});

// ---------------------------------------------------------------------------
// POST /log/batch  — log multiple events at once
// ---------------------------------------------------------------------------
router.post('/log/batch', async (req: Request, res: Response) => {
  try {
    const { teamId, events } = req.body;
    if (!teamId || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ error: 'teamId and events array are required' });
      return;
    }
    if (events.length > 100) {
      res.status(400).json({ error: 'Maximum 100 events per batch' });
      return;
    }

    const membership = await teamModel.getMembership(teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const mapped = events.map((e: any) => ({
      teamId,
      userId: req.scribeUserId!,
      eventType: e.eventType,
      noteId: e.noteId,
      metadata: e.metadata,
      eventDate: e.eventDate,
    }));

    const count = await metricModel.logBatch(mapped);
    res.status(201).json({ logged: count });
  } catch (err: any) {
    console.error('POST /api/metrics/log/batch error:', err);
    res.status(500).json({ error: 'Failed to log metric events' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/summary  — aggregate counts by event type
// ---------------------------------------------------------------------------
router.get('/:teamId/summary', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const { from, to, userId } = req.query;

    // Members can only see their own data
    const role = (req as any).teamRole;
    const effectiveUserId = role === 'member'
      ? req.scribeUserId!
      : (userId as string | undefined);

    const summary = await metricModel.summary(req.params.teamId, {
      from: from as string | undefined,
      to: to as string | undefined,
      userId: effectiveUserId,
    });
    res.json({ summary });
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/daily  — daily breakdown
// ---------------------------------------------------------------------------
router.get('/:teamId/daily', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const { from, to, userId, eventType } = req.query;

    const role = (req as any).teamRole;
    const effectiveUserId = role === 'member'
      ? req.scribeUserId!
      : (userId as string | undefined);

    const daily = await metricModel.dailyBreakdown(req.params.teamId, {
      from: from as string | undefined,
      to: to as string | undefined,
      userId: effectiveUserId,
      eventType: eventType as string | undefined,
    });
    res.json({ daily });
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/daily error:', err);
    res.status(500).json({ error: 'Failed to fetch daily breakdown' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/providers  — breakdown by provider (lead/admin only)
// ---------------------------------------------------------------------------
router.get('/:teamId/providers', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const role = (req as any).teamRole;
    if (role === 'member') {
      res.status(403).json({ error: 'Only leads and admins can view provider breakdown' });
      return;
    }

    const { from, to, eventType } = req.query;
    const providers = await metricModel.providerBreakdown(req.params.teamId, {
      from: from as string | undefined,
      to: to as string | undefined,
      eventType: eventType as string | undefined,
    });
    res.json({ providers });
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/providers error:', err);
    res.status(500).json({ error: 'Failed to fetch provider breakdown' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/events  — paginated event list
// ---------------------------------------------------------------------------
router.get('/:teamId/events', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const { from, to, userId, eventType, limit, offset } = req.query;

    const role = (req as any).teamRole;
    const effectiveUserId = role === 'member'
      ? req.scribeUserId!
      : (userId as string | undefined);

    const result = await metricModel.listEvents(req.params.teamId, {
      from: from as string | undefined,
      to: to as string | undefined,
      userId: effectiveUserId,
      eventType: eventType as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/events error:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ---------------------------------------------------------------------------
// GET /event-types  — list well-known event types
// ---------------------------------------------------------------------------
router.get('/event-types', (_req: Request, res: Response) => {
  res.json({ eventTypes: EVENT_TYPES });
});

export default router;
