import { getPool } from '../database/db.js';
import { MetricEventModel } from '../models/metricEvent.js';

const metricModel = new MetricEventModel();

// ---------------------------------------------------------------------------
// Note-type → event-type mapping
// ---------------------------------------------------------------------------

const NOTE_TYPE_TO_EVENTS: Record<string, string[]> = {
  progress_note:     ['patient_encounter', 'note_completed'],
  h_and_p:           ['patient_encounter', 'admission', 'note_completed'],
  transfer_note:     ['patient_encounter', 'transfer', 'note_completed'],
  accept_note:       ['patient_encounter', 'admission', 'note_completed'],
  consult_note:      ['patient_encounter', 'consult', 'note_completed'],
  discharge_summary: ['patient_encounter', 'discharge', 'note_completed'],
  procedure_note:    ['patient_encounter', 'procedure', 'note_completed'],
  event_note:        ['patient_encounter', 'note_completed'],
};

// ---------------------------------------------------------------------------
// Auto-capture: called after a note is saved
// ---------------------------------------------------------------------------

export async function captureNoteMetrics(input: {
  userId: string;
  noteId: string;
  noteType: string;
  teamId?: string;
  isNew: boolean; // true = INSERT, false = UPDATE (skip to avoid double-counting)
}): Promise<void> {
  // Only capture on first save (INSERT), not updates
  if (!input.isNew) return;

  try {
    const pool = getPool();

    // Determine which team(s) to log to
    let teamIds: string[] = [];

    if (input.teamId) {
      // Explicit team provided — verify membership
      const check = await pool.query(
        'SELECT team_id FROM team_members WHERE team_id = $1 AND user_id = $2',
        [input.teamId, input.userId],
      );
      if ((check.rowCount ?? 0) > 0) {
        teamIds = [input.teamId];
      }
    } else {
      // No team specified — auto-log to all teams the user belongs to
      const result = await pool.query(
        'SELECT team_id FROM team_members WHERE user_id = $1',
        [input.userId],
      );
      teamIds = result.rows.map(r => r.team_id);
    }

    if (teamIds.length === 0) return;

    // Get event types for this note type
    const eventTypes = NOTE_TYPE_TO_EVENTS[input.noteType] || ['note_completed'];

    // Build batch of events
    const events = teamIds.flatMap(teamId =>
      eventTypes.map(eventType => ({
        teamId,
        userId: input.userId,
        eventType,
        noteId: input.noteId,
        metadata: { noteType: input.noteType, source: 'auto' },
      })),
    );

    if (events.length > 0) {
      await metricModel.logBatch(events);
    }
  } catch (err) {
    // Fire-and-forget — never block note save on metric capture failure
    console.error('[MetricAutoCapture] Failed to capture metrics:', err);
  }
}
