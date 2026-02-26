import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';
import { PREBUILT_SECTIONS } from '../database/prebuiltSections.js';

export interface ScribeSectionTemplate {
  id: string;
  user_id: string | null;
  name: string;
  prompt_hint: string | null;
  is_prebuilt: number;
  category: string;
  disciplines: string;
  created_at: string;
  updated_at: string;
}

export class ScribeSectionTemplateModel {
  async seedPrebuilt(): Promise<void> {
    const pool = getPool();

    // Rename migration: "Neurological Status" (icu) → "Neurological" (body_systems)
    await pool.query(
      `UPDATE scribe_section_templates
         SET name = 'Neurological', category = 'body_systems'
       WHERE name = 'Neurological Status' AND is_prebuilt = 1`
    );

    for (const s of PREBUILT_SECTIONS) {
      const existing = await pool.query(
        'SELECT 1 FROM scribe_section_templates WHERE is_prebuilt = 1 AND name = $1',
        [s.name]
      );
      if ((existing.rowCount ?? 0) === 0) {
        // New section — insert with full discipline data
        await pool.query(
          'INSERT INTO scribe_section_templates (id, user_id, name, prompt_hint, is_prebuilt, category, disciplines) VALUES ($1, NULL, $2, $3, 1, $4, $5)',
          [randomUUID(), s.name, s.promptHint ?? null, s.category, JSON.stringify(s.disciplines)]
        );
      } else {
        // Existing section — sync category and disciplines (idempotent)
        await pool.query(
          'UPDATE scribe_section_templates SET category = $1, disciplines = $2 WHERE name = $3 AND is_prebuilt = 1',
          [s.category, JSON.stringify(s.disciplines), s.name]
        );
      }
    }
  }

  async listPrebuilt(): Promise<ScribeSectionTemplate[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_section_templates WHERE is_prebuilt = 1 ORDER BY name ASC'
    );
    return result.rows;
  }

  async listForUser(userId: string): Promise<ScribeSectionTemplate[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_section_templates WHERE is_prebuilt = 1 OR user_id = $1 ORDER BY is_prebuilt DESC, name ASC',
      [userId]
    );
    return result.rows;
  }

  async create(input: { userId: string; name: string; promptHint?: string }): Promise<ScribeSectionTemplate> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      'INSERT INTO scribe_section_templates (id, user_id, name, prompt_hint, is_prebuilt) VALUES ($1, $2, $3, $4, 0)',
      [id, input.userId, input.name, input.promptHint ?? null]
    );
    return (await this.findById(id, input.userId))!;
  }

  async findById(id: string, userId: string): Promise<ScribeSectionTemplate | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_section_templates WHERE id = $1 AND (user_id = $2 OR is_prebuilt = 1)',
      [id, userId]
    );
    return result.rows[0] ?? null;
  }

  async update(id: string, userId: string, fields: { name?: string; promptHint?: string }): Promise<{ rowCount: number | null }> {
    const pool = getPool();
    const result = await pool.query(
      'UPDATE scribe_section_templates SET name = COALESCE($1, name), prompt_hint = COALESCE($2, prompt_hint), updated_at = NOW() WHERE id = $3 AND user_id = $4 AND is_prebuilt = 0',
      [fields.name ?? null, fields.promptHint ?? null, id, userId]
    );
    return { rowCount: result.rowCount };
  }

  async delete(id: string, userId: string): Promise<{ rowCount: number | null }> {
    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM scribe_section_templates WHERE id = $1 AND user_id = $2 AND is_prebuilt = 0',
      [id, userId]
    );
    return { rowCount: result.rowCount };
  }
}
