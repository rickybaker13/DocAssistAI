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
// GET /:teamId/export  — export metrics as CSV (lead/admin only)
// ---------------------------------------------------------------------------
router.get('/:teamId/export', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const role = (req as any).teamRole;
    if (role === 'member') {
      res.status(403).json({ error: 'Only leads and admins can export metrics' });
      return;
    }

    const { from, to } = req.query;
    const team = await teamModel.findById(req.params.teamId);
    const teamName = team?.name || 'team';

    // Get all events for the period
    const result = await metricModel.listEvents(req.params.teamId, {
      from: from as string | undefined,
      to: to as string | undefined,
      limit: 10000,
    });

    // Get provider names
    const members = await teamModel.listMembers(req.params.teamId);
    const nameMap: Record<string, string> = {};
    for (const m of members) nameMap[m.user_id] = m.name || m.email;

    // Build CSV
    const header = 'Date,Event Type,Provider,Note ID,Metadata';
    const rows = result.events.map(e => {
      const date = typeof e.event_date === 'string' ? e.event_date : new Date(e.event_date).toISOString().slice(0, 10);
      const provider = nameMap[e.user_id] || e.user_id;
      const meta = JSON.stringify(e.metadata || {}).replace(/"/g, '""');
      return `${date},"${e.event_type}","${provider}","${e.note_id || ''}","${meta}"`;
    });
    const csv = [header, ...rows].join('\n');

    const filename = `${teamName.replace(/[^a-zA-Z0-9]/g, '_')}_metrics_${from || 'all'}_to_${to || 'now'}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/export error:', err);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/report  — generate a summary report (JSON for frontend rendering)
// ---------------------------------------------------------------------------
router.get('/:teamId/report', requireTeamMember, async (req: Request, res: Response) => {
  try {
    const role = (req as any).teamRole;
    if (role === 'member') {
      res.status(403).json({ error: 'Only leads and admins can generate reports' });
      return;
    }

    const { from, to } = req.query;
    const team = await teamModel.findById(req.params.teamId);

    const [summary, daily, providers] = await Promise.all([
      metricModel.summary(req.params.teamId, {
        from: from as string | undefined,
        to: to as string | undefined,
      }),
      metricModel.dailyBreakdown(req.params.teamId, {
        from: from as string | undefined,
        to: to as string | undefined,
      }),
      metricModel.providerBreakdown(req.params.teamId, {
        from: from as string | undefined,
        to: to as string | undefined,
      }),
    ]);

    const totalEvents = summary.reduce((sum, s) => sum + s.count, 0);
    const uniqueDays = new Set(daily.map(d => d.event_date)).size;
    const avgPerDay = uniqueDays > 0 ? Math.round(totalEvents / uniqueDays * 10) / 10 : 0;

    res.json({
      team: { name: team?.name, specialty: team?.specialty },
      period: { from: from || null, to: to || null },
      generatedAt: new Date().toISOString(),
      totals: { events: totalEvents, days: uniqueDays, avgPerDay },
      summary,
      daily,
      providers,
    });
  } catch (err: any) {
    console.error('GET /api/metrics/:teamId/report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ---------------------------------------------------------------------------
// GET /event-types  — list well-known event types
// ---------------------------------------------------------------------------
router.get('/event-types', (_req: Request, res: Response) => {
  res.json({ eventTypes: EVENT_TYPES });
});

export default router;
