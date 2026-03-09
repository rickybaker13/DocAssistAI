import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeExitSurvey {
  id: string;
  user_id: string;
  reason: string;
  suggestion: string | null;
  created_at: string;
}

export class ScribeExitSurveyModel {
  async create(input: {
    userId: string;
    reason: string;
    suggestion?: string | null;
  }): Promise<ScribeExitSurvey> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_exit_surveys (id, user_id, reason, suggestion)
       VALUES ($1, $2, $3, $4)`,
      [id, input.userId, input.reason, input.suggestion ?? null],
    );
    const result = await pool.query('SELECT * FROM scribe_exit_surveys WHERE id = $1', [id]);
    return result.rows[0];
  }

  async findByUserId(userId: string): Promise<ScribeExitSurvey | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_exit_surveys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async listAll(): Promise<ScribeExitSurvey[]> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_exit_surveys ORDER BY created_at DESC');
    return result.rows;
  }
}
