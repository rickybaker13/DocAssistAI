import { randomUUID, createHash } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribeUser {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  specialty: string | null;
  created_at: string;
  updated_at: string;
}

export class ScribeUserModel {
  async create(input: { email: string; passwordHash: string; name?: string; specialty?: string }): Promise<ScribeUser> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      'INSERT INTO scribe_users (id, email, password_hash, name, specialty) VALUES ($1, $2, $3, $4, $5)',
      [id, input.email, input.passwordHash, input.name ?? null, input.specialty ?? null]
    );
    return (await this.findById(id))!;
  }

  async findByEmail(email: string): Promise<ScribeUser | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<ScribeUser | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM scribe_users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: { name?: string | null; specialty?: string | null }): Promise<ScribeUser | null> {
    const pool = getPool();
    await pool.query(
      'UPDATE scribe_users SET name = COALESCE($1, name), specialty = COALESCE($2, specialty), updated_at = NOW() WHERE id = $3',
      [fields.name ?? null, fields.specialty ?? null, id]
    );
    return this.findById(id);
  }

  async createPasswordResetToken(userId: string): Promise<string> {
    const pool = getPool();
    const rawToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await pool.query('DELETE FROM scribe_password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query(
      `INSERT INTO scribe_password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '30 minutes')`,
      [randomUUID(), userId, tokenHash]
    );
    return rawToken;
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const pool = getPool();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const result = await pool.query(
      `SELECT id, user_id
       FROM scribe_password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    const row = result.rows[0];
    if (!row) return null;
    await pool.query('UPDATE scribe_password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);
    return row.user_id as string;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const pool = getPool();
    await pool.query('UPDATE scribe_users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
  }
}
