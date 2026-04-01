import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from './scribeUser.js';
import { CodingTeamModel } from './codingTeam.js';
import { CodingTeamMemberModel } from './codingTeamMember.js';

const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const memberModel = new CodingTeamMemberModel();

describe('CodingTeam + CodingTeamMember models', () => {
  let managerId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'manager@test.com', passwordHash: 'hash' });
    managerId = user.id;
  });

  afterAll(async () => { await closePool(); });

  it('creates a team and returns it', async () => {
    const team = await teamModel.create({ name: 'Test Coding Team', managerUserId: managerId });
    expect(team.id).toBeDefined();
    expect(team.name).toBe('Test Coding Team');
    expect(team.manager_user_id).toBe(managerId);
    expect(team.included_seats).toBe(2);
    expect(team.included_notes).toBe(500);
  });

  it('finds team by id', async () => {
    const team = await teamModel.create({ name: 'Find Me', managerUserId: managerId });
    const found = await teamModel.findById(team.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Find Me');
  });

  it('finds team by manager', async () => {
    const found = await teamModel.findByManager(managerId);
    expect(found).not.toBeNull();
  });

  it('updates team name', async () => {
    const team = await teamModel.create({ name: 'Old Name', managerUserId: managerId });
    const updated = await teamModel.update(team.id, { name: 'New Name' });
    expect(updated!.name).toBe('New Name');
  });

  it('adds a member to a team', async () => {
    const team = await teamModel.create({ name: 'Member Team', managerUserId: managerId });
    const coder = await userModel.create({ email: 'coder1@test.com', passwordHash: 'hash' });
    const member = await memberModel.create({
      teamId: team.id,
      userId: coder.id,
      role: 'coder',
      invitedBy: managerId,
    });
    expect(member.status).toBe('pending');
    expect(member.role).toBe('coder');
  });

  it('lists members of a team', async () => {
    const team = await teamModel.create({ name: 'List Team', managerUserId: managerId });
    const c1 = await userModel.create({ email: 'list-c1@test.com', passwordHash: 'hash' });
    const c2 = await userModel.create({ email: 'list-c2@test.com', passwordHash: 'hash' });
    await memberModel.create({ teamId: team.id, userId: c1.id, role: 'coder', invitedBy: managerId });
    await memberModel.create({ teamId: team.id, userId: c2.id, role: 'coder', invitedBy: managerId });
    const members = await memberModel.listByTeam(team.id);
    expect(members.length).toBe(2);
  });

  it('activates a pending member', async () => {
    const team = await teamModel.create({ name: 'Activate Team', managerUserId: managerId });
    const coder = await userModel.create({ email: 'activate@test.com', passwordHash: 'hash' });
    const member = await memberModel.create({ teamId: team.id, userId: coder.id, role: 'coder', invitedBy: managerId });
    const activated = await memberModel.activate(member.id);
    expect(activated!.status).toBe('active');
    expect(activated!.accepted_at).not.toBeNull();
  });

  it('deactivates a member', async () => {
    const team = await teamModel.create({ name: 'Deactivate Team', managerUserId: managerId });
    const coder = await userModel.create({ email: 'deactivate@test.com', passwordHash: 'hash' });
    const member = await memberModel.create({ teamId: team.id, userId: coder.id, role: 'coder', invitedBy: managerId });
    await memberModel.activate(member.id);
    const deactivated = await memberModel.deactivate(member.id);
    expect(deactivated!.status).toBe('deactivated');
  });

  it('counts active members', async () => {
    const team = await teamModel.create({ name: 'Count Team', managerUserId: managerId });
    const c1 = await userModel.create({ email: 'count1@test.com', passwordHash: 'hash' });
    const c2 = await userModel.create({ email: 'count2@test.com', passwordHash: 'hash' });
    const m1 = await memberModel.create({ teamId: team.id, userId: c1.id, role: 'coder', invitedBy: managerId });
    await memberModel.create({ teamId: team.id, userId: c2.id, role: 'coder', invitedBy: managerId });
    await memberModel.activate(m1.id);
    // Only m1 is active, m2 is still pending
    const count = await memberModel.countActiveByTeam(team.id);
    expect(count).toBe(1);
  });
});
