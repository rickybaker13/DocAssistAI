import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingTeam {
  id: string;
  name: string;
  manager_user_id: string;
  plan_tier: string;
  included_seats: number;
  included_notes: number;
  overage_rate_cents: number;
  billing_cycle_start: string;
  created_at: string;
  updated_at: string;
}

export class CodingTeamModel {
  async create(input: { name: string; managerUserId: string }): Promise<CodingTeam> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO coding_teams (id, name, manager_user_id) VALUES ($1, $2, $3)`,
      [id, input.name, input.managerUserId],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingTeam | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_teams WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async findByManager(managerUserId: string): Promise<CodingTeam | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_teams WHERE manager_user_id = $1', [managerUserId]);
    return result.rows[0] ?? null;
  }

  async update(id: string, fields: Partial<Pick<CodingTeam, 'name' | 'plan_tier'>>): Promise<CodingTeam | null> {
    const pool = getPool();
    await pool.query(
      `UPDATE coding_teams SET name = COALESCE($1, name), plan_tier = COALESCE($2, plan_tier), updated_at = NOW() WHERE id = $3`,
      [fields.name ?? null, fields.plan_tier ?? null, id],
    );
    return this.findById(id);
  }
}
