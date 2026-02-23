import { randomUUID } from 'crypto';
import { getDb } from '../database/db';

export interface ScribeNoteSection {
  id: string;
  note_id: string;
  section_name: string;
  content: string | null;
  prompt_hint: string | null;
  display_order: number;
  confidence: number | null;
  focused_ai_result: string | null;
  chat_insertions: string;
  created_at: string;
  updated_at: string;
}

export class ScribeNoteSectionModel {
  private static readonly ALLOWED_UPDATE_COLUMNS = new Set(['content', 'confidence', 'focused_ai_result', 'chat_insertions', 'display_order']);

  create(input: { noteId: string; sectionName: string; displayOrder: number; promptHint?: string }): ScribeNoteSection {
    const id = randomUUID();
    getDb().prepare(
      'INSERT INTO scribe_note_sections (id, note_id, section_name, display_order, prompt_hint) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.noteId, input.sectionName, input.displayOrder, input.promptHint ?? null);
    return this.findById(id)!;
  }

  bulkCreate(items: Array<{ noteId: string; sectionName: string; displayOrder: number; promptHint?: string; content?: string; confidence?: number }>): ScribeNoteSection[] {
    return items.map(item => {
      const id = randomUUID();
      getDb().prepare(
        'INSERT INTO scribe_note_sections (id, note_id, section_name, display_order, prompt_hint, content, confidence) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, item.noteId, item.sectionName, item.displayOrder, item.promptHint ?? null, item.content ?? null, item.confidence ?? null);
      return this.findById(id)!;
    });
  }

  listForNote(noteId: string): ScribeNoteSection[] {
    return getDb().prepare(
      'SELECT * FROM scribe_note_sections WHERE note_id = ? ORDER BY display_order ASC'
    ).all(noteId) as ScribeNoteSection[];
  }

  findById(id: string): ScribeNoteSection | null {
    return (getDb().prepare('SELECT * FROM scribe_note_sections WHERE id = ?').get(id) ?? null) as ScribeNoteSection | null;
  }

  /**
   * Updates a section by ID.
   * IMPORTANT: Does NOT verify user ownership of the section.
   * Callers MUST verify that the parent note belongs to the user before calling this.
   * Use: noteModel.findById(note_id, userId) before calling update().
   */
  update(id: string, fields: Partial<Pick<ScribeNoteSection, 'content' | 'confidence' | 'focused_ai_result' | 'chat_insertions' | 'display_order'>>): void {
    const keys = Object.keys(fields);
    for (const key of keys) {
      if (!ScribeNoteSectionModel.ALLOWED_UPDATE_COLUMNS.has(key)) {
        throw new Error(`Invalid column: ${key}`);
      }
    }
    const sets = keys.map(k => `${k} = ?`).join(', ');
    getDb().prepare(
      `UPDATE scribe_note_sections SET ${sets}, updated_at = ? WHERE id = ?`
    ).run(...Object.values(fields), new Date().toISOString(), id);
  }

  deleteForNote(noteId: string): void {
    getDb().prepare('DELETE FROM scribe_note_sections WHERE note_id = ?').run(noteId);
  }
}
