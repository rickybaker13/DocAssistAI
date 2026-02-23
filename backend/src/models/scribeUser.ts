import { randomUUID } from 'crypto';
import { getDb } from '../database/db.js';

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
  create(input: { email: string; passwordHash: string; name?: string; specialty?: string }): ScribeUser {
    const db = getDb();
    const id = randomUUID();
    db.prepare(
      'INSERT INTO scribe_users (id, email, password_hash, name, specialty) VALUES (?, ?, ?, ?, ?)'
    ).run(id, input.email, input.passwordHash, input.name ?? null, input.specialty ?? null);
    return this.findById(id)!;
  }

  findByEmail(email: string): ScribeUser | null {
    const row = getDb().prepare('SELECT * FROM scribe_users WHERE email = ?').get(email);
    return (row as ScribeUser) ?? null;
  }

  findById(id: string): ScribeUser | null {
    const row = getDb().prepare('SELECT * FROM scribe_users WHERE id = ?').get(id);
    return (row as ScribeUser) ?? null;
  }
}
