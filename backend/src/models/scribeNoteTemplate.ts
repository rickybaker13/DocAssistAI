import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';
import { SYSTEM_NOTE_TEMPLATES } from '../database/systemNoteTemplates.js';

export interface NoteTemplate {
  id: string; user_id: string | null; note_type: string; name: string;
  verbosity: 'brief' | 'standard' | 'detailed'; sections: string; created_at: string;
}

export class ScribeNoteTemplateModel {
  async seedSystem(): Promise<void> {
    const pool = getPool();
    for (const t of SYSTEM_NOTE_TEMPLATES) {
      const existing = await pool.query(
        'SELECT 1 FROM note_templates WHERE user_id IS NULL AND note_type = $1 AND name = $2',
        [t.noteType, t.name]
      );
      if ((existing.rowCount ?? 0) === 0) {
        await pool.query(
          'INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES ($1, NULL, $2, $3, $4, $5)',
          [randomUUID(), t.noteType, t.name, t.verbosity, JSON.stringify(t.sections)]
        );
      }
    }
  }

  async listSystem(noteType: string): Promise<NoteTemplate[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM note_templates WHERE user_id IS NULL AND note_type = $1 ORDER BY name ASC',
      [noteType]
    );
    return result.rows;
  }

  async listForUser(userId: string, noteType: string): Promise<NoteTemplate[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM note_templates WHERE (user_id IS NULL OR user_id = $1) AND note_type = $2 ORDER BY user_id ASC, name ASC',
      [userId, noteType]
    );
    return result.rows;
  }

  async create(input: { userId: string; noteType: string; name: string; verbosity: 'brief' | 'standard' | 'detailed'; sections: Array<{ name: string; promptHint: string | null }> }): Promise<NoteTemplate> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      'INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, input.userId, input.noteType, input.name, input.verbosity, JSON.stringify(input.sections)]
    );
    const result = await pool.query('SELECT * FROM note_templates WHERE id = $1', [id]);
    return result.rows[0] as NoteTemplate;
  }

  async delete(id: string, userId: string): Promise<{ rowCount: number }> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM note_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return { rowCount: result.rowCount ?? 0 };
  }
}
