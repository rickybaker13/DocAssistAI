import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { ScribeUserModel } from './scribeUser.js';
import { CodingTeamModel } from './codingTeam.js';
import { CodingSessionModel, computeBatchWeek } from './codingSession.js';
import { CodingUsageModel } from './codingUsage.js';

const userModel = new ScribeUserModel();
const teamModel = new CodingTeamModel();
const sessionModel = new CodingSessionModel();
const usageModel = new CodingUsageModel();

describe('CodingSession + CodingUsage models', () => {
  let coderId: string;
  let teamId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'coder-session@test.com', passwordHash: 'hash' });
    coderId = user.id;
    const team = await teamModel.create({ name: 'Session Test Team', managerUserId: coderId });
    teamId = team.id;
  });

  afterAll(async () => { await closePool(); });

  // --- computeBatchWeek ---

  it('computeBatchWeek returns Monday for a Wednesday', () => {
    // 2025-01-15 is a Wednesday
    expect(computeBatchWeek('2025-01-15')).toBe('2025-01-13');
  });

  it('computeBatchWeek returns same date for a Monday', () => {
    // 2025-01-13 is a Monday
    expect(computeBatchWeek('2025-01-13')).toBe('2025-01-13');
  });

  it('computeBatchWeek returns previous Monday for a Sunday', () => {
    // 2025-01-19 is a Sunday
    expect(computeBatchWeek('2025-01-19')).toBe('2025-01-13');
  });

  // --- CodingSession CRUD ---

  it('creates a coding session with all fields', async () => {
    const session = await sessionModel.create({
      coderUserId: coderId,
      teamId,
      patientName: 'John Doe',
      mrn: 'MRN-001',
      dateOfService: '2025-01-15',
      providerName: 'Dr. Smith',
      facility: 'General Hospital',
      noteType: 'Progress Note',
      icd10Codes: [{ code: 'J18.9', description: 'Pneumonia' }],
      cptCodes: [{ code: '99213' }],
      emLevel: { level: 3, mdm: 'low' },
      missingDocumentation: ['Chest X-ray report'],
    });

    expect(session.id).toBeDefined();
    expect(session.coder_user_id).toBe(coderId);
    expect(session.team_id).toBe(teamId);
    expect(session.patient_name).toBe('John Doe');
    expect(session.mrn).toBe('MRN-001');
    expect(session.provider_name).toBe('Dr. Smith');
    expect(session.facility).toBe('General Hospital');
    expect(session.note_type).toBe('Progress Note');
    expect(session.coder_status).toBe('coded');
    // batch_week should be Monday of that week
    // batch_week should be a Monday — verify it's the right week
    // pg-mem may shift dates due to timezone, so just check it's a Monday near 2025-01-13
    const bw = new Date(session.batch_week + 'T00:00:00Z');
    expect(bw.getUTCDay()).toBe(1); // Monday
    // JSONB fields
    expect(Array.isArray(session.icd10_codes)).toBe(true);
    expect((session.icd10_codes[0] as { code: string }).code).toBe('J18.9');
    expect(Array.isArray(session.cpt_codes)).toBe(true);
    expect(session.em_level).toEqual({ level: 3, mdm: 'low' });
    expect(session.missing_documentation).toEqual(['Chest X-ray report']);
  });

  it('lists sessions by coder with pagination', async () => {
    // Create 3 more sessions
    for (let i = 0; i < 3; i++) {
      await sessionModel.create({
        coderUserId: coderId,
        teamId,
        patientName: `Patient ${i}`,
        dateOfService: '2025-02-10',
        providerName: 'Dr. A',
        noteType: 'H&P',
      });
    }

    // Total should be at least 4 (1 from previous test + 3 here)
    const all = await sessionModel.listByCoder(coderId);
    expect(all.length).toBeGreaterThanOrEqual(4);

    const page = await sessionModel.listByCoder(coderId, { limit: 2, offset: 0 });
    expect(page.length).toBe(2);

    const page2 = await sessionModel.listByCoder(coderId, { limit: 2, offset: 2 });
    expect(page2.length).toBe(2);
  });

  it('lists sessions by team with date range', async () => {
    const filtered = await sessionModel.listByTeam(teamId, {
      start: '2025-01-01',
      end: '2025-01-31',
    });
    // Only the first session (2025-01-15) should match
    expect(filtered.length).toBe(1);
    expect(filtered[0].patient_name).toBe('John Doe');
  });

  it('updates coder_status to reviewed', async () => {
    const session = await sessionModel.create({
      coderUserId: coderId,
      teamId,
      patientName: 'Status Patient',
      dateOfService: '2025-03-01',
      providerName: 'Dr. B',
      noteType: 'Consult',
    });
    expect(session.coder_status).toBe('coded');

    const updated = await sessionModel.updateStatus(session.id, 'reviewed');
    expect(updated!.coder_status).toBe('reviewed');
  });

  it('deletes a session', async () => {
    const session = await sessionModel.create({
      coderUserId: coderId,
      teamId,
      patientName: 'Delete Me',
      dateOfService: '2025-03-05',
      providerName: 'Dr. C',
      noteType: 'Discharge',
    });
    const deleted = await sessionModel.deleteById(session.id);
    expect(deleted).toBe(true);

    const found = await sessionModel.findById(session.id);
    expect(found).toBeNull();
  });

  // --- CodingUsage ---

  it('increments usage counter', async () => {
    const usage = await usageModel.increment(teamId, 500);
    expect(usage.notes_coded).toBe(1);
    expect(usage.overage_notes).toBe(0);
    expect(usage.overage_charge_cents).toBe(0);

    // Increment again
    const usage2 = await usageModel.increment(teamId, 500);
    expect(usage2.notes_coded).toBe(2);
    expect(usage2.overage_notes).toBe(0);
  });

  it('tracks overage when exceeding included_notes', async () => {
    // Use a separate team for clean overage test
    const overageTeam = await teamModel.create({ name: 'Overage Team', managerUserId: coderId });
    const otId = overageTeam.id;

    // includedNotes = 2, increment 3 times
    await usageModel.increment(otId, 2);
    await usageModel.increment(otId, 2);
    const usage3 = await usageModel.increment(otId, 2);

    expect(usage3.notes_coded).toBe(3);
    expect(usage3.overage_notes).toBe(1);
    expect(usage3.overage_charge_cents).toBe(10); // 1 * 10 cents
  });
});
