import { randomUUID, randomBytes } from 'crypto';
import { getPool } from '../database/db.js';

export interface Team {
  id: string;
  name: string;
  specialty: string | null;
  settings: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'admin' | 'lead' | 'member';
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  role: 'admin' | 'lead' | 'member';
  max_uses: number | null;
  uses: number;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export type TeamRole = 'admin' | 'lead' | 'member';

export class TeamModel {
  // ---------------------------------------------------------------------------
  // Team CRUD
  // ---------------------------------------------------------------------------

  async create(input: {
    name: string;
    specialty?: string;
    settings?: Record<string, unknown>;
    createdBy: string;
  }): Promise<Team> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO teams (id, name, specialty, settings, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.name, input.specialty ?? null, JSON.stringify(input.settings ?? {}), input.createdBy],
    );

    // Creator becomes admin
    await pool.query(
      `INSERT INTO team_members (id, team_id, user_id, role)
       VALUES ($1, $2, $3, 'admin')`,
      [randomUUID(), id, input.createdBy],
    );

    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<Team | null> {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM teams WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async update(id: string, userId: string, fields: { name?: string; specialty?: string; settings?: Record<string, unknown> }): Promise<Team | null> {
    const pool = getPool();

    // Only admins can update
    const memberCheck = await this.getMembership(id, userId);
    if (!memberCheck || memberCheck.role !== 'admin') return null;

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (fields.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(fields.name);
    }
    if (fields.specialty !== undefined) {
      setClauses.push(`specialty = $${paramIndex++}`);
      values.push(fields.specialty);
    }
    if (fields.settings !== undefined) {
      setClauses.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(fields.settings));
    }

    if (setClauses.length === 0) return this.findById(id);

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE teams SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values,
    );
    return this.findById(id);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const memberCheck = await this.getMembership(id, userId);
    if (!memberCheck || memberCheck.role !== 'admin') return false;

    const pool = getPool();
    const result = await pool.query('DELETE FROM teams WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Membership
  // ---------------------------------------------------------------------------

  async getMembership(teamId: string, userId: string): Promise<TeamMember | null> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId],
    );
    return result.rows[0] ?? null;
  }

  async listTeamsForUser(userId: string): Promise<(Team & { role: TeamRole })[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT t.*, tm.role
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async listMembers(teamId: string): Promise<(TeamMember & { name: string | null; email: string })[]> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT tm.*, su.name, su.email
       FROM team_members tm
       JOIN scribe_users su ON su.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId],
    );
    return result.rows;
  }

  async updateMemberRole(teamId: string, targetUserId: string, newRole: TeamRole, requesterId: string): Promise<boolean> {
    const requester = await this.getMembership(teamId, requesterId);
    if (!requester || requester.role !== 'admin') return false;

    const pool = getPool();
    const result = await pool.query(
      'UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3',
      [newRole, teamId, targetUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async removeMember(teamId: string, targetUserId: string, requesterId: string): Promise<boolean> {
    const requester = await this.getMembership(teamId, requesterId);
    if (!requester) return false;

    // Members can remove themselves; admins can remove anyone
    if (requester.role !== 'admin' && targetUserId !== requesterId) return false;

    const pool = getPool();
    const result = await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, targetUserId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Invites
  // ---------------------------------------------------------------------------

  async createInvite(input: {
    teamId: string;
    createdBy: string;
    role?: TeamRole;
    maxUses?: number;
    expiresInHours?: number;
  }): Promise<TeamInvite> {
    // Only admins and leads can invite
    const member = await this.getMembership(input.teamId, input.createdBy);
    if (!member || member.role === 'member') {
      throw new Error('Only admins and leads can create invites');
    }

    // Leads can only invite members, not admins/leads
    if (member.role === 'lead' && input.role && input.role !== 'member') {
      throw new Error('Leads can only invite members');
    }

    const pool = getPool();
    const id = randomUUID();
    const token = randomBytes(6).toString('base64url'); // Short, URL-safe token
    const expiresAt = input.expiresInHours
      ? new Date(Date.now() + input.expiresInHours * 3600_000).toISOString()
      : null;

    await pool.query(
      `INSERT INTO team_invites (id, team_id, token, role, max_uses, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, input.teamId, token, input.role ?? 'member', input.maxUses ?? null, input.createdBy, expiresAt],
    );

    const result = await pool.query('SELECT * FROM team_invites WHERE id = $1', [id]);
    return result.rows[0];
  }

  async redeemInvite(token: string, userId: string): Promise<{ team: Team; role: TeamRole } | { error: string }> {
    const pool = getPool();

    const inviteResult = await pool.query('SELECT * FROM team_invites WHERE token = $1', [token]);
    const invite = inviteResult.rows[0] as TeamInvite | undefined;

    if (!invite) return { error: 'Invalid invite code' };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { error: 'Invite has expired' };
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) return { error: 'Invite has reached its usage limit' };

    // Check if already a member
    const existing = await this.getMembership(invite.team_id, userId);
    if (existing) return { error: 'You are already a member of this team' };

    // Add member
    await pool.query(
      `INSERT INTO team_members (id, team_id, user_id, role)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), invite.team_id, userId, invite.role],
    );

    // Increment uses
    await pool.query('UPDATE team_invites SET uses = uses + 1 WHERE id = $1', [invite.id]);

    const team = (await this.findById(invite.team_id))!;
    return { team, role: invite.role as TeamRole };
  }

  async revokeInvite(inviteId: string, userId: string): Promise<boolean> {
    const pool = getPool();

    // Look up invite to find team
    const inviteResult = await pool.query('SELECT team_id FROM team_invites WHERE id = $1', [inviteId]);
    if ((inviteResult.rowCount ?? 0) === 0) return false;

    const teamId = inviteResult.rows[0].team_id;
    const member = await this.getMembership(teamId, userId);
    if (!member || member.role === 'member') return false;

    const result = await pool.query('DELETE FROM team_invites WHERE id = $1', [inviteId]);
    return (result.rowCount ?? 0) > 0;
  }

  async listInvites(teamId: string): Promise<TeamInvite[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM team_invites WHERE team_id = $1 ORDER BY created_at DESC',
      [teamId],
    );
    return result.rows;
  }
}
