import { jest } from '@jest/globals';
import { ScribeSectionTemplateModel } from './scribeSectionTemplate.js';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('ScribeSectionTemplateModel', () => {
  const model = new ScribeSectionTemplateModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
    const user = await userModel.create({ email: 'tmpl@test.com', passwordHash: 'hash' });
    userId = user.id;
    await model.seedPrebuilt();
  });
  afterAll(async () => { await closePool(); });

  it('seeds prebuilt sections (system templates with null user_id)', async () => {
    const prebuilt = await model.listPrebuilt();
    expect(prebuilt.length).toBeGreaterThan(10);
    expect(prebuilt.every(t => t.is_prebuilt === 1 || t.is_prebuilt === true)).toBe(true);
  });

  it('creates a custom user section', async () => {
    const tmpl = await model.create({ userId, name: 'Vasopressor Weaning', promptHint: 'Document dose and targets' });
    expect(tmpl.id).toBeTruthy();
    expect(tmpl.name).toBe('Vasopressor Weaning');
    expect(tmpl.is_prebuilt === 0 || tmpl.is_prebuilt === false).toBe(true);
  });

  it('lists user templates (prebuilt + user custom)', async () => {
    const all = await model.listForUser(userId);
    const hasPrebuilt = all.some(t => t.is_prebuilt === 1 || t.is_prebuilt === true);
    const hasCustom = all.some(t => t.user_id === userId);
    expect(hasPrebuilt).toBe(true);
    expect(hasCustom).toBe(true);
  });

  it('updates a custom section', async () => {
    const tmpl = await model.create({ userId, name: 'Old Name' });
    await model.update(tmpl.id, userId, { name: 'New Name', promptHint: 'Updated hint' });
    const updated = await model.findById(tmpl.id, userId);
    expect(updated!.name).toBe('New Name');
  });

  it('deletes a custom section', async () => {
    const tmpl = await model.create({ userId, name: 'To Delete' });
    await model.delete(tmpl.id, userId);
    expect(await model.findById(tmpl.id, userId)).toBeNull();
  });
});
