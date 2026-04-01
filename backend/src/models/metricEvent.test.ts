import { jest } from '@jest/globals';
import { MetricEventModel } from './metricEvent.js';
import { TeamModel } from './team.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('MetricEventModel', () => {
  const metricModel = new MetricEventModel();
  const teamModel = new TeamModel();
  const userModel = new ScribeUserModel();
  let teamId: string;
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();

    const user = await userModel.create({ email: 'metrics-user@test.com', passwordHash: 'hash1', name: 'Dr. Metrics' });
    userId = user.id;
    const team = await teamModel.create({ name: 'Metrics Test Team', createdBy: userId });
    teamId = team.id;
  });

  afterAll(async () => { await closePool(); });

  it('logs a single event', async () => {
    const event = await metricModel.log({
      teamId,
      userId,
      eventType: 'patient_encounter',
      metadata: { noteType: 'progress_note' },
    });
    expect(event.id).toBeTruthy();
    expect(event.event_type).toBe('patient_encounter');
    expect(event.team_id).toBe(teamId);
  });

  it('logs a batch of events', async () => {
    const count = await metricModel.logBatch([
      { teamId, userId, eventType: 'admission' },
      { teamId, userId, eventType: 'procedure', metadata: { type: 'central_line' } },
      { teamId, userId, eventType: 'patient_encounter' },
    ]);
    expect(count).toBe(3);
  });

  it('returns summary by event type', async () => {
    const summary = await metricModel.summary(teamId);
    expect(summary.length).toBeGreaterThanOrEqual(2);

    const encounters = summary.find(s => s.event_type === 'patient_encounter');
    expect(encounters).toBeDefined();
    expect(encounters!.count).toBe(2);
  });

  it('returns daily breakdown', async () => {
    const daily = await metricModel.dailyBreakdown(teamId);
    expect(daily.length).toBeGreaterThan(0);
    expect(daily[0].event_date).toBeTruthy();
    expect(daily[0].count).toBeGreaterThan(0);
  });

  it('returns provider breakdown', async () => {
    const providers = await metricModel.providerBreakdown(teamId);
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].user_id).toBe(userId);
    expect(providers[0].name).toBe('Dr. Metrics');
  });

  it('lists events with pagination', async () => {
    const result = await metricModel.listEvents(teamId, { limit: 2 });
    expect(result.events.length).toBe(2);
    expect(result.total).toBe(4);
  });

  it('filters by event type', async () => {
    const summary = await metricModel.summary(teamId, { userId });
    const procedures = summary.find(s => s.event_type === 'procedure');
    expect(procedures).toBeDefined();
    expect(procedures!.count).toBe(1);
  });
});
