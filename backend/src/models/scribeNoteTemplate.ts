import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../database/db';
import { SYSTEM_NOTE_TEMPLATES } from '../database/systemNoteTemplates.js';

export interface NoteTemplate {
  id: string;
  user_id: string | null;
  note_type: string;
  name: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  sections: string; // JSON string
  created_at: string;
}

export class ScribeNoteTemplateModel {
  seedSystem(): void {
    const existing = getDb()
      .prepare('SELECT COUNT(*) as count FROM note_templates WHERE user_id IS NULL')
      .get() as { count: number };
    if (existing.count > 0) return;
    const insert = getDb().prepare(
      'INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES (?, NULL, ?, ?, ?, ?)'
    );
    const insertAll = getDb().transaction(() => {
      for (const t of SYSTEM_NOTE_TEMPLATES) {
        insert.run(randomUUID(), t.noteType, t.name, t.verbosity, JSON.stringify(t.sections));
      }
    });
    insertAll();
  }

  listSystem(noteType: string): NoteTemplate[] {
    return getDb()
      .prepare('SELECT * FROM note_templates WHERE user_id IS NULL AND note_type = ? ORDER BY name ASC')
      .all(noteType) as NoteTemplate[];
  }

  listForUser(userId: string, noteType: string): NoteTemplate[] {
    return getDb()
      .prepare(
        'SELECT * FROM note_templates WHERE (user_id IS NULL OR user_id = ?) AND note_type = ? ORDER BY user_id ASC, name ASC'
      )
      .all(userId, noteType) as NoteTemplate[];
  }

  create(input: {
    userId: string;
    noteType: string;
    name: string;
    verbosity: 'brief' | 'standard' | 'detailed';
    sections: Array<{ name: string; promptHint: string | null }>;
  }): NoteTemplate {
    const id = randomUUID();
    getDb()
      .prepare('INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.userId, input.noteType, input.name, input.verbosity, JSON.stringify(input.sections));
    return getDb().prepare('SELECT * FROM note_templates WHERE id = ?').get(id) as NoteTemplate;
  }

  delete(id: string, userId: string): Database.RunResult {
    return getDb()
      .prepare('DELETE FROM note_templates WHERE id = ? AND user_id = ?')
      .run(id, userId);
  }
}
