import { jest } from '@jest/globals';
import { ScribeUserModel } from './scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';

describe('ScribeUserModel', () => {
  const model = new ScribeUserModel();

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await initPool();
    await runMigrations();
  });
  afterAll(async () => { await closePool(); });

  it('creates a new user and returns it', async () => {
    const user = await model.create({ email: 'a@test.com', passwordHash: 'hash1', name: 'Alice' });
    expect(user.id).toBeTruthy();
    expect(user.email).toBe('a@test.com');
    expect(user.name).toBe('Alice');
  });

  it('finds user by email', async () => {
    const found = await model.findByEmail('a@test.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('a@test.com');
  });

  it('finds user by id', async () => {
    const created = await model.create({ email: 'b@test.com', passwordHash: 'hash2' });
    const found = await model.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('returns null for unknown email', async () => {
    expect(await model.findByEmail('nobody@test.com')).toBeNull();
  });
});
