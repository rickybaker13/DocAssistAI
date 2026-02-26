import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeNote {
  id: string; user_id: string; note_type: string; patient_label: string | null;
  verbosity: string; transcript: string | null; status: string; deleted_at: string | null;
  created_at: string; updated_at: string;
}

export class ScribeNoteModel {
  private static readonly ALLOWED_UPDATE_COLUMNS = new Set(['transcript', 'status', 'patient_label', 'verbosity']);

  async create(input: { userId: string; noteType: string; patientLabel?: string; verbosity?: string }): Promise<ScribeNote> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      'INSERT INTO scribe_notes (id, user_id, note_type, patient_label, verbosity) VALUES ($1, $2, $3, $4, $5)',
      [id, input.userId, input.noteType, input.patientLabel ?? null, input.verbosity ?? 'standard']
    );
    return (await this.findByIdUnchecked(id))!;
  }

  async listForUser(userId: string): Promise<ScribeNote[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_notes WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async findById(id: string, userId: string): Promise<ScribeNote | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_notes WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, userId: string, fields: Partial<Pick<ScribeNote, 'transcript' | 'status' | 'patient_label' | 'verbosity'>>): Promise<void> {
    const pool = getPool();
    const keys = Object.keys(fields);
    for (const key of keys) {
      if (!ScribeNoteModel.ALLOWED_UPDATE_COLUMNS.has(key)) throw new Error(`Invalid column: ${key}`);
    }
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = [...Object.values(fields), new Date().toISOString(), id, userId];
    await pool.query(
      `UPDATE scribe_notes SET ${sets}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2} AND user_id = $${keys.length + 3}`,
      vals
    );
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      'UPDATE scribe_notes SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  private async findByIdUnchecked(id: string): Promise<ScribeNote | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_notes WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }
}
