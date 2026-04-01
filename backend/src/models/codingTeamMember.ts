import { getPool } from '../database/db.js';
import { randomUUID } from 'crypto';

export interface CodingTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'manager' | 'coder';
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
  status: 'pending' | 'active' | 'deactivated';
}

export class CodingTeamMemberModel {
  async create(input: { teamId: string; userId: string; role: 'manager' | 'coder'; invitedBy: string }): Promise<CodingTeamMember> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO coding_team_members (id, team_id, user_id, role, invited_by) VALUES ($1, $2, $3, $4, $5)`,
      [id, input.teamId, input.userId, input.role, input.invitedBy],
    );
    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_team_members WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async listByTeam(teamId: string): Promise<CodingTeamMember[]> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM coding_team_members WHERE team_id = $1 ORDER BY invited_at', [teamId]);
    return result.rows;
  }

  async activate(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    await pool.query(`UPDATE coding_team_members SET status = 'active', accepted_at = NOW() WHERE id = $1`, [id]);
    return this.findById(id);
  }

  async deactivate(id: string): Promise<CodingTeamMember | null> {
    const pool = getPool();
    await pool.query(`UPDATE coding_team_members SET status = 'deactivated' WHERE id = $1`, [id]);
    return this.findById(id);
  }

  async countActiveByTeam(teamId: string): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM coding_team_members WHERE team_id = $1 AND status = 'active'`,
      [teamId],
    );
    return parseInt(result.rows[0].count, 10);
  }
}
