import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../database/db';
import { PREBUILT_SECTIONS } from '../database/prebuiltSections';

export interface ScribeSectionTemplate {
  id: string;
  user_id: string | null;
  name: string;
  prompt_hint: string | null;
  is_prebuilt: number;
  created_at: string;
  updated_at: string;
}

export class ScribeSectionTemplateModel {
  seedPrebuilt(): void {
    const existing = getDb().prepare('SELECT COUNT(*) as count FROM scribe_section_templates WHERE is_prebuilt = 1').get() as { count: number };
    if (existing.count > 0) return;
    const insert = getDb().prepare(
      'INSERT INTO scribe_section_templates (id, user_id, name, prompt_hint, is_prebuilt) VALUES (?, NULL, ?, ?, 1)'
    );
    for (const s of PREBUILT_SECTIONS) {
      insert.run(randomUUID(), s.name, s.promptHint);
    }
  }

  listPrebuilt(): ScribeSectionTemplate[] {
    return getDb().prepare('SELECT * FROM scribe_section_templates WHERE is_prebuilt = 1 ORDER BY name ASC').all() as ScribeSectionTemplate[];
  }

  listForUser(userId: string): ScribeSectionTemplate[] {
    return getDb().prepare(
      'SELECT * FROM scribe_section_templates WHERE is_prebuilt = 1 OR user_id = ? ORDER BY is_prebuilt DESC, name ASC'
    ).all(userId) as ScribeSectionTemplate[];
  }

  create(input: { userId: string; name: string; promptHint?: string }): ScribeSectionTemplate {
    const id = randomUUID();
    getDb().prepare(
      'INSERT INTO scribe_section_templates (id, user_id, name, prompt_hint, is_prebuilt) VALUES (?, ?, ?, ?, 0)'
    ).run(id, input.userId, input.name, input.promptHint ?? null);
    return this.findById(id, input.userId)!;
  }

  findById(id: string, userId: string): ScribeSectionTemplate | null {
    return (getDb().prepare(
      'SELECT * FROM scribe_section_templates WHERE id = ? AND (user_id = ? OR is_prebuilt = 1)'
    ).get(id, userId) ?? null) as ScribeSectionTemplate | null;
  }

  update(id: string, userId: string, fields: { name?: string; promptHint?: string }): Database.RunResult {
    return getDb().prepare(
      'UPDATE scribe_section_templates SET name = COALESCE(?, name), prompt_hint = COALESCE(?, prompt_hint), updated_at = ? WHERE id = ? AND user_id = ? AND is_prebuilt = 0'
    ).run(fields.name ?? null, fields.promptHint ?? null, new Date().toISOString(), id, userId);
  }

  delete(id: string, userId: string): Database.RunResult {
    return getDb().prepare(
      'DELETE FROM scribe_section_templates WHERE id = ? AND user_id = ? AND is_prebuilt = 0'
    ).run(id, userId);
  }
}
