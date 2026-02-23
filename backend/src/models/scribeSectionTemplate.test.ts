import { ScribeSectionTemplateModel } from './scribeSectionTemplate';
import { ScribeUserModel } from './scribeUser';
import { closeDb } from '../database/db';

describe('ScribeSectionTemplateModel', () => {
  const model = new ScribeSectionTemplateModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    const user = userModel.create({ email: 'tmpl@test.com', passwordHash: 'hash' });
    userId = user.id;
    model.seedPrebuilt();
  });
  afterAll(() => closeDb());

  it('seeds prebuilt sections (system templates with null user_id)', () => {
    const prebuilt = model.listPrebuilt();
    expect(prebuilt.length).toBeGreaterThan(10);
    expect(prebuilt.every(t => t.is_prebuilt === 1)).toBe(true);
  });

  it('creates a custom user section', () => {
    const tmpl = model.create({ userId, name: 'Vasopressor Weaning', promptHint: 'Document dose and targets' });
    expect(tmpl.id).toBeTruthy();
    expect(tmpl.name).toBe('Vasopressor Weaning');
    expect(tmpl.is_prebuilt).toBe(0);
  });

  it('lists user templates (prebuilt + user custom)', () => {
    const all = model.listForUser(userId);
    const hasPrebuilt = all.some(t => t.is_prebuilt === 1);
    const hasCustom = all.some(t => t.user_id === userId);
    expect(hasPrebuilt).toBe(true);
    expect(hasCustom).toBe(true);
  });

  it('updates a custom section', () => {
    const tmpl = model.create({ userId, name: 'Old Name' });
    model.update(tmpl.id, userId, { name: 'New Name', promptHint: 'Updated hint' });
    const updated = model.findById(tmpl.id, userId);
    expect(updated!.name).toBe('New Name');
  });

  it('deletes a custom section', () => {
    const tmpl = model.create({ userId, name: 'To Delete' });
    model.delete(tmpl.id, userId);
    expect(model.findById(tmpl.id, userId)).toBeNull();
  });
});
