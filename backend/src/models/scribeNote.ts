import { randomUUID } from 'crypto';
import { getDb } from '../database/db';

export interface ScribeNote {
  id: string;
  user_id: string;
  note_type: string;
  patient_label: string | null;
  verbosity: string;
  transcript: string | null;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export class ScribeNoteModel {
  private static readonly ALLOWED_UPDATE_COLUMNS = new Set(['transcript', 'status', 'patient_label', 'verbosity']);

  create(input: { userId: string; noteType: string; patientLabel?: string; verbosity?: string }): ScribeNote {
    const id = randomUUID();
    getDb().prepare(
      'INSERT INTO scribe_notes (id, user_id, note_type, patient_label, verbosity) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.userId, input.noteType, input.patientLabel ?? null, input.verbosity ?? 'standard');
    return this.findByIdUnchecked(id)!;
  }

  listForUser(userId: string): ScribeNote[] {
    return getDb().prepare(
      'SELECT * FROM scribe_notes WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
    ).all(userId) as ScribeNote[];
  }

  findById(id: string, userId: string): ScribeNote | null {
    return (getDb().prepare(
      'SELECT * FROM scribe_notes WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
    ).get(id, userId) ?? null) as ScribeNote | null;
  }

  update(id: string, userId: string, fields: Partial<Pick<ScribeNote, 'transcript' | 'status' | 'patient_label'>>): void {
    const keys = Object.keys(fields);
    for (const key of keys) {
      if (!ScribeNoteModel.ALLOWED_UPDATE_COLUMNS.has(key)) {
        throw new Error(`Invalid column: ${key}`);
      }
    }
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const vals = [...Object.values(fields), new Date().toISOString(), id, userId];
    getDb().prepare(
      `UPDATE scribe_notes SET ${sets}, updated_at = ? WHERE id = ? AND user_id = ?`
    ).run(...vals);
  }

  softDelete(id: string, userId: string): void {
    const now = new Date().toISOString();
    getDb().prepare(
      'UPDATE scribe_notes SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(now, now, id, userId);
  }

  private findByIdUnchecked(id: string): ScribeNote | null {
    return (getDb().prepare('SELECT * FROM scribe_notes WHERE id = ?').get(id) ?? null) as ScribeNote | null;
  }
}
