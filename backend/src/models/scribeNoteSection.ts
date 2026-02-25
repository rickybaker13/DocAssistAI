import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeNoteSection {
  id: string; note_id: string; section_name: string; content: string | null;
  prompt_hint: string | null; display_order: number; confidence: number | null;
  focused_ai_result: string | null; chat_insertions: string; created_at: string; updated_at: string;
}

export class ScribeNoteSectionModel {
  private static readonly ALLOWED_UPDATE_COLUMNS = new Set(['content', 'confidence', 'focused_ai_result', 'chat_insertions', 'display_order']);

  async create(input: { noteId: string; sectionName: string; displayOrder: number; promptHint?: string }): Promise<ScribeNoteSection> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      'INSERT INTO scribe_note_sections (id, note_id, section_name, display_order, prompt_hint) VALUES ($1, $2, $3, $4, $5)',
      [id, input.noteId, input.sectionName, input.displayOrder, input.promptHint ?? null]
    );
    return (await this.findById(id))!;
  }

  async bulkCreate(items: Array<{ noteId: string; sectionName: string; displayOrder: number; promptHint?: string; content?: string; confidence?: number }>): Promise<ScribeNoteSection[]> {
    const results: ScribeNoteSection[] = [];
    for (const item of items) {
      const pool = getPool();
      const id = randomUUID();
      await pool.query(
        'INSERT INTO scribe_note_sections (id, note_id, section_name, display_order, prompt_hint, content, confidence) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, item.noteId, item.sectionName, item.displayOrder, item.promptHint ?? null, item.content ?? null, item.confidence ?? null]
      );
      results.push((await this.findById(id))!);
    }
    return results;
  }

  async listForNote(noteId: string): Promise<ScribeNoteSection[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_note_sections WHERE note_id = $1 ORDER BY display_order ASC',
      [noteId]
    );
    return result.rows;
  }

  async findById(id: string): Promise<ScribeNoteSection | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_note_sections WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: Partial<Pick<ScribeNoteSection, 'content' | 'confidence' | 'focused_ai_result' | 'chat_insertions' | 'display_order'>>): Promise<void> {
    const pool = getPool();
    const keys = Object.keys(fields);
    for (const key of keys) {
      if (!ScribeNoteSectionModel.ALLOWED_UPDATE_COLUMNS.has(key)) throw new Error(`Invalid column: ${key}`);
    }
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const vals = [...Object.values(fields), new Date().toISOString(), id];
    await pool.query(
      `UPDATE scribe_note_sections SET ${sets}, updated_at = $${keys.length + 1} WHERE id = $${keys.length + 2}`,
      vals
    );
  }

  async deleteForNote(noteId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM scribe_note_sections WHERE note_id = $1', [noteId]);
  }
}
