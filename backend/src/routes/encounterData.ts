import { Router, Request, Response } from 'express';
import { EncounterDataModel } from '../models/encounterData.js';
import { TeamModel } from '../models/team.js';
import { extractClinicalData } from '../services/clinicalExtractor.js';
import { getPool } from '../database/db.js';

const router = Router();
const encounterModel = new EncounterDataModel();
const teamModel = new TeamModel();

// ---------------------------------------------------------------------------
// POST /extract  — AI-extract clinical data from note content
// ---------------------------------------------------------------------------
router.post('/extract', async (req: Request, res: Response) => {
  try {
    const { teamId, noteId, noteType, noteContent } = req.body;
    if (!teamId || !noteContent) {
      res.status(400).json({ error: 'teamId and noteContent are required' });
      return;
    }

    const membership = await teamModel.getMembership(teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const extracted = await extractClinicalData(noteContent, noteType || 'progress_note');
    if (!extracted) {
      res.status(422).json({ error: 'Could not extract clinical data from this note' });
      return;
    }

    // Save to database
    const encounter = await encounterModel.upsertByNoteId({
      teamId,
      userId: req.scribeUserId!,
      noteId: noteId || undefined,
      primaryDiagnosis: extracted.primaryDiagnosis || undefined,
      diagnosisCodes: extracted.diagnosisCodes,
      acuityScores: extracted.acuityScores,
      complications: extracted.complications,
      interventions: extracted.interventions,
      disposition: extracted.disposition || undefined,
      source: 'auto_extracted',
    });

    res.json({ encounter, extracted });
  } catch (err: any) {
    console.error('POST /api/encounters/extract error:', err);
    res.status(500).json({ error: 'Failed to extract clinical data' });
  }
});

// ---------------------------------------------------------------------------
// POST /  — manually create/update encounter data
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { teamId, noteId, primaryDiagnosis, diagnosisCodes, acuityScores,
            complications, interventions, disposition, admissionDate, dischargeDate, metadata } = req.body;
    if (!teamId) {
      res.status(400).json({ error: 'teamId is required' });
      return;
    }

    const membership = await teamModel.getMembership(teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const encounter = noteId
      ? await encounterModel.upsertByNoteId({
          teamId, userId: req.scribeUserId!, noteId,
          primaryDiagnosis, diagnosisCodes, acuityScores,
          complications, interventions, disposition,
          admissionDate, dischargeDate, metadata,
          source: 'manual',
        })
      : await encounterModel.create({
          teamId, userId: req.scribeUserId!,
          primaryDiagnosis, diagnosisCodes, acuityScores,
          complications, interventions, disposition,
          admissionDate, dischargeDate, metadata,
          source: 'manual',
        });

    res.status(201).json({ encounter });
  } catch (err: any) {
    console.error('POST /api/encounters error:', err);
    res.status(500).json({ error: 'Failed to save encounter data' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id  — update encounter data (provider corrections)
// ---------------------------------------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await encounterModel.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Encounter not found' });
      return;
    }

    const membership = await teamModel.getMembership(existing.team_id, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const { primaryDiagnosis, diagnosisCodes, acuityScores, complications,
            interventions, disposition, admissionDate, dischargeDate, metadata } = req.body;

    const encounter = await encounterModel.update(req.params.id, {
      primaryDiagnosis, diagnosisCodes, acuityScores,
      complications, interventions, disposition,
      admissionDate, dischargeDate, metadata,
      source: 'edited',
    });

    res.json({ encounter });
  } catch (err: any) {
    console.error('PUT /api/encounters/:id error:', err);
    res.status(500).json({ error: 'Failed to update encounter data' });
  }
});

// ---------------------------------------------------------------------------
// GET /note/:noteId  — get encounter data for a specific note
// ---------------------------------------------------------------------------
router.get('/note/:noteId', async (req: Request, res: Response) => {
  try {
    const { teamId } = req.query;
    if (!teamId) {
      res.status(400).json({ error: 'teamId query param is required' });
      return;
    }

    const membership = await teamModel.getMembership(teamId as string, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const encounter = await encounterModel.findByNoteId(req.params.noteId, teamId as string);
    res.json({ encounter: encounter || null });
  } catch (err: any) {
    console.error('GET /api/encounters/note/:noteId error:', err);
    res.status(500).json({ error: 'Failed to fetch encounter data' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/query  — population-level query
// ---------------------------------------------------------------------------
router.get('/:teamId/query', async (req: Request, res: Response) => {
  try {
    const membership = await teamModel.getMembership(req.params.teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    // Members can only query — leads/admins see provider-level detail
    const role = membership.role;
    const { from, to, diagnosis, complication, intervention, disposition, userId, limit, offset } = req.query;

    const result = await encounterModel.query({
      teamId: req.params.teamId,
      from: from as string | undefined,
      to: to as string | undefined,
      diagnosis: diagnosis as string | undefined,
      complication: complication as string | undefined,
      intervention: intervention as string | undefined,
      disposition: disposition as string | undefined,
      userId: role === 'member' ? req.scribeUserId! : (userId as string | undefined),
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    console.error('GET /api/encounters/:teamId/query error:', err);
    res.status(500).json({ error: 'Failed to query encounters' });
  }
});

// ---------------------------------------------------------------------------
// GET /:teamId/stats  — population-level statistics
// ---------------------------------------------------------------------------
router.get('/:teamId/stats', async (req: Request, res: Response) => {
  try {
    const membership = await teamModel.getMembership(req.params.teamId, req.scribeUserId!);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this team' });
      return;
    }

    const { from, to } = req.query;
    const opts = { from: from as string | undefined, to: to as string | undefined };

    const [diagnoses, complications, acuity, dispositions, totalResult] = await Promise.all([
      encounterModel.diagnosisCounts(req.params.teamId, opts),
      encounterModel.complicationCounts(req.params.teamId, opts),
      encounterModel.acuityAverages(req.params.teamId, opts),
      encounterModel.dispositionCounts(req.params.teamId, opts),
      encounterModel.query({ teamId: req.params.teamId, ...opts, limit: 0 }),
    ]);

    res.json({
      total: totalResult.total,
      diagnoses,
      complications,
      acuityAverages: acuity,
      dispositions,
    });
  } catch (err: any) {
    console.error('GET /api/encounters/:teamId/stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id  — delete encounter data
// ---------------------------------------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await encounterModel.delete(req.params.id, req.scribeUserId!);
    if (!deleted) {
      res.status(404).json({ error: 'Encounter not found or not authorized' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/encounters/:id error:', err);
    res.status(500).json({ error: 'Failed to delete encounter data' });
  }
});

export default router;
