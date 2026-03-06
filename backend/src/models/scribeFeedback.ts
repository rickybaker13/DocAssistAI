import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeFeedbackRecord {
  id: string;
  user_id: string;
  category: 'bug' | 'feature_request' | 'general' | 'praise';
  message: string;
  status: 'new' | 'read' | 'resolved';
  admin_note: string | null;
  created_at: string;
  // Joined fields (admin list only)
  user_email?: string;
  user_name?: string;
}

const VALID_CATEGORIES = ['bug', 'feature_request', 'general', 'praise'];
const VALID_STATUSES = ['new', 'read', 'resolved'];

export class ScribeFeedbackModel {
  async create(input: { userId: string; category: string; message: string }): Promise<ScribeFeedbackRecord> {
    if (!VALID_CATEGORIES.includes(input.category)) {
      throw new Error('Invalid category');
    }
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_feedback (id, user_id, category, message)
       VALUES ($1, $2, $3, $4)`,
      [id, input.userId, input.category, input.message],
    );
    const result = await pool.query('SELECT * FROM scribe_feedback WHERE id = $1', [id]);
    return result.rows[0] as ScribeFeedbackRecord;
  }

  async countRecentByUser(userId: string, windowMinutes: number): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) FROM scribe_feedback
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute' * $2`,
      [userId, windowMinutes],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async listForUser(userId: string, limit = 50): Promise<ScribeFeedbackRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_feedback WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows as ScribeFeedbackRecord[];
  }

  async listAll(filters: { category?: string; status?: string }, limit = 50): Promise<ScribeFeedbackRecord[]> {
    const pool = getPool();
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.category && VALID_CATEGORIES.includes(filters.category)) {
      conditions.push(`f.category = $${paramIndex++}`);
      params.push(filters.category);
    }
    if (filters.status && VALID_STATUSES.includes(filters.status)) {
      conditions.push(`f.status = $${paramIndex++}`);
      params.push(filters.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await pool.query(
      `SELECT f.*, u.email AS user_email, u.name AS user_name
       FROM scribe_feedback f
       JOIN scribe_users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${paramIndex}`,
      params,
    );
    return result.rows as ScribeFeedbackRecord[];
  }

  async updateStatus(id: string, fields: { status?: string; adminNote?: string }): Promise<ScribeFeedbackRecord | null> {
    if (fields.status && !VALID_STATUSES.includes(fields.status)) {
      throw new Error('Invalid status');
    }
    const pool = getPool();
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (fields.status) {
      sets.push(`status = $${paramIndex++}`);
      params.push(fields.status);
    }
    if (fields.adminNote !== undefined) {
      sets.push(`admin_note = $${paramIndex++}`);
      params.push(fields.adminNote);
    }

    if (sets.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE scribe_feedback SET ${sets.join(', ')} WHERE id = $${paramIndex}`,
      params,
    );
    const result = await pool.query('SELECT * FROM scribe_feedback WHERE id = $1', [id]);
    return result.rows[0] as ScribeFeedbackRecord ?? null;
  }
}
