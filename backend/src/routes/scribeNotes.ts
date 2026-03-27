import { Router, Request, Response } from 'express';
import { getPool } from '../database/db.js';
import { captureNoteMetrics } from '../services/metricAutoCapture.js';

const router = Router();

// ---------------------------------------------------------------------------
// GET /  — list all notes for the authenticated user (dashboard)
// ---------------------------------------------------------------------------
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, note_type, patient_label, verbosity, status, created_at, updated_at
       FROM scribe_notes
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.scribeUserId],
    );
    res.json({ notes: result.rows });
  } catch (err: any) {
    console.error('GET /api/scribe/notes error:', err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id  — get a single note with all fields
// ---------------------------------------------------------------------------
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, note_type, patient_label, verbosity, transcript, sections, status, created_at, updated_at
       FROM scribe_notes
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.scribeUserId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ note: result.rows[0] });
  } catch (err: any) {
    console.error('GET /api/scribe/notes/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// ---------------------------------------------------------------------------
// POST /  — create or upsert a note
// ---------------------------------------------------------------------------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, note_type, patient_label, verbosity, transcript, sections, status, team_id } = req.body;
    if (!id || !note_type) {
      res.status(400).json({ error: 'id and note_type are required' });
      return;
    }
    const pool = getPool();

    // Check if this note already exists (to distinguish INSERT vs UPDATE for metrics)
    const existing = await pool.query('SELECT id FROM scribe_notes WHERE id = $1', [id]);
    const isNew = (existing.rowCount ?? 0) === 0;

    await pool.query(
      `INSERT INTO scribe_notes (id, user_id, note_type, patient_label, verbosity, transcript, sections, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         note_type = EXCLUDED.note_type,
         patient_label = EXCLUDED.patient_label,
         verbosity = EXCLUDED.verbosity,
         transcript = EXCLUDED.transcript,
         sections = EXCLUDED.sections,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        id,
        req.scribeUserId,
        note_type,
        patient_label || '',
        verbosity || 'standard',
        transcript || '',
        JSON.stringify(sections || []),
        status || 'draft',
      ],
    );

    // Fire-and-forget: auto-capture metrics for the user's teams
    captureNoteMetrics({
      userId: req.scribeUserId!,
      noteId: id,
      noteType: note_type,
      teamId: team_id,
      isNew,
    }).catch(() => {});

    res.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/scribe/notes error:', err);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id  — update specific fields of a note
// ---------------------------------------------------------------------------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();

    // Verify ownership
    const check = await pool.query(
      `SELECT id FROM scribe_notes WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.scribeUserId],
    );
    if ((check.rowCount ?? 0) === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    // Build dynamic SET clause from allowed fields
    const allowed = ['note_type', 'patient_label', 'verbosity', 'transcript', 'sections', 'status'];
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        const val = field === 'sections' ? JSON.stringify(req.body[field]) : req.body[field];
        setClauses.push(`${field} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(req.params.id);
    values.push(req.scribeUserId);

    await pool.query(
      `UPDATE scribe_notes SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      values,
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('PUT /api/scribe/notes/:id error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id  — delete a note
// ---------------------------------------------------------------------------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `DELETE FROM scribe_notes WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.scribeUserId],
    );
    if ((result.rowCount ?? 0) === 0) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/scribe/notes/:id error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
