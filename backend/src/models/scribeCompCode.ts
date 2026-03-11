import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';
import { ScribeUserModel } from './scribeUser.js';

export interface CompCode {
  id: string;
  code: string;
  label: string | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface CompCodeRedemption {
  id: string;
  code_id: string;
  user_id: string;
  redeemed_at: string;
  email?: string;
}

const userModel = new ScribeUserModel();

export class ScribeCompCodeModel {
  async create(input: {
    code: string;
    label?: string;
    maxUses?: number;
    expiresAt?: string;
    createdBy: string;
  }): Promise<CompCode> {
    const pool = getPool();
    const id = randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO scribe_comp_codes (id, code, label, max_uses, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.code.trim(), input.label || null, input.maxUses || null, input.expiresAt || null, input.createdBy],
    );
    return rows[0];
  }

  async findByCode(code: string): Promise<CompCode | null> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM scribe_comp_codes WHERE UPPER(code) = UPPER($1)`,
      [code.trim()],
    );
    return rows[0] || null;
  }

  async findById(id: string): Promise<CompCode | null> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM scribe_comp_codes WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  async listAll(): Promise<CompCode[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM scribe_comp_codes ORDER BY created_at DESC`,
    );
    return rows;
  }

  async deactivate(id: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_comp_codes SET active = FALSE WHERE id = $1`,
      [id],
    );
  }

  async activate(id: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      `UPDATE scribe_comp_codes SET active = TRUE WHERE id = $1`,
      [id],
    );
  }

  async listRedemptions(codeId: string): Promise<CompCodeRedemption[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT r.*, u.email
       FROM scribe_comp_code_redemptions r
       JOIN scribe_users u ON u.id = r.user_id
       WHERE r.code_id = $1
       ORDER BY r.redeemed_at DESC`,
      [codeId],
    );
    return rows;
  }

  async redeem(
    codeStr: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const pool = getPool();

    const code = await this.findByCode(codeStr);
    if (!code) {
      return { success: false, error: 'Invalid code' };
    }
    if (!code.active) {
      return { success: false, error: 'This code is no longer active' };
    }
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      return { success: false, error: 'This code has expired' };
    }
    if (code.max_uses !== null && code.uses_count >= code.max_uses) {
      return { success: false, error: 'This code has reached its maximum number of uses' };
    }

    // Check if user is already comp
    const user = await userModel.findById(userId);
    if (user?.subscription_status === 'comp') {
      return { success: false, error: 'Your account already has complimentary access' };
    }

    // Check if user already redeemed this specific code
    const { rowCount } = await pool.query(
      `SELECT 1 FROM scribe_comp_code_redemptions WHERE code_id = $1 AND user_id = $2`,
      [code.id, userId],
    );
    if ((rowCount ?? 0) > 0) {
      return { success: false, error: 'You have already redeemed this code' };
    }

    // Transaction: increment uses, insert redemption, grant comp
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE scribe_comp_codes SET uses_count = uses_count + 1 WHERE id = $1`,
        [code.id],
      );

      await client.query(
        `INSERT INTO scribe_comp_code_redemptions (id, code_id, user_id) VALUES ($1, $2, $3)`,
        [randomUUID(), code.id, userId],
      );

      await client.query(
        `UPDATE scribe_users
         SET subscription_status = 'comp',
             cancelled_at = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
