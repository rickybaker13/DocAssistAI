import { randomUUID } from 'crypto';
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
}
