import { jest } from '@jest/globals';
import { TeamModel } from './team.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('TeamModel', () => {
  const teamModel = new TeamModel();
  const userModel = new ScribeUserModel();
  let adminId: string;
  let memberId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();

    const admin = await userModel.create({ email: 'team-admin@test.com', passwordHash: 'hash1', name: 'Admin' });
    adminId = admin.id;
    const member = await userModel.create({ email: 'team-member@test.com', passwordHash: 'hash2', name: 'Member' });
    memberId = member.id;
  });

  afterAll(async () => { await closePool(); });

  let teamId: string;

  it('creates a team and makes creator admin', async () => {
    const team = await teamModel.create({ name: 'ICU Team', specialty: 'Critical Care', createdBy: adminId });
    expect(team.id).toBeTruthy();
    expect(team.name).toBe('ICU Team');
    expect(team.specialty).toBe('Critical Care');
    teamId = team.id;

    const membership = await teamModel.getMembership(teamId, adminId);
    expect(membership).not.toBeNull();
    expect(membership!.role).toBe('admin');
  });

  it('lists teams for a user', async () => {
    const teams = await teamModel.listTeamsForUser(adminId);
    expect(teams.length).toBeGreaterThanOrEqual(1);
    expect(teams[0].role).toBe('admin');
  });

  it('updates team settings (admin only)', async () => {
    const updated = await teamModel.update(teamId, adminId, { name: 'ICU Alpha' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('ICU Alpha');
  });

  it('rejects update from non-admin', async () => {
    const result = await teamModel.update(teamId, memberId, { name: 'Nope' });
    expect(result).toBeNull();
  });

  describe('invites', () => {
    let inviteToken: string;

    it('creates an invite', async () => {
      const invite = await teamModel.createInvite({ teamId, createdBy: adminId, maxUses: 5, expiresInHours: 24 });
      expect(invite.token).toBeTruthy();
      expect(invite.max_uses).toBe(5);
      inviteToken = invite.token;
    });

    it('redeems an invite', async () => {
      const result = await teamModel.redeemInvite(inviteToken, memberId);
      expect('team' in result).toBe(true);
      if ('team' in result) {
        expect(result.team.id).toBe(teamId);
        expect(result.role).toBe('member');
      }
    });

    it('rejects duplicate join', async () => {
      const result = await teamModel.redeemInvite(inviteToken, memberId);
      expect('error' in result).toBe(true);
    });

    it('rejects invalid token', async () => {
      const result = await teamModel.redeemInvite('bogus-token', adminId);
      expect('error' in result).toBe(true);
    });
  });

  describe('member management', () => {
    it('lists members', async () => {
      const members = await teamModel.listMembers(teamId);
      expect(members.length).toBe(2);
    });

    it('updates member role (admin only)', async () => {
      const ok = await teamModel.updateMemberRole(teamId, memberId, 'lead', adminId);
      expect(ok).toBe(true);
      const m = await teamModel.getMembership(teamId, memberId);
      expect(m!.role).toBe('lead');
    });

    it('rejects role update from non-admin', async () => {
      const ok = await teamModel.updateMemberRole(teamId, adminId, 'member', memberId);
      expect(ok).toBe(false);
    });

    it('allows self-leave', async () => {
      const ok = await teamModel.removeMember(teamId, memberId, memberId);
      expect(ok).toBe(true);
    });
  });
});
