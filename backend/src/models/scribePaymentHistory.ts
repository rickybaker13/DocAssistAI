import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribePaymentRecord {
  id: string;
  user_id: string;
  square_payment_id: string | null;
  amount_cents: number;
  status: 'completed' | 'failed' | 'refunded';
  failure_reason: string | null;
  created_at: string;
}

export class ScribePaymentHistoryModel {
  async create(input: {
    userId: string;
    squarePaymentId?: string;
    amountCents: number;
    status: 'completed' | 'failed' | 'refunded';
    failureReason?: string;
  }): Promise<ScribePaymentRecord> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_payment_history (id, user_id, square_payment_id, amount_cents, status, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.userId, input.squarePaymentId ?? null, input.amountCents, input.status, input.failureReason ?? null],
    );
    const result = await pool.query('SELECT * FROM scribe_payment_history WHERE id = $1', [id]);
    return result.rows[0] as ScribePaymentRecord;
  }

  async listForUser(userId: string, limit = 50): Promise<ScribePaymentRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_payment_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows as ScribePaymentRecord[];
  }
}
