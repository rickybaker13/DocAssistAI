import { ScribeUserModel } from './scribeUser.js';
import { closeDb } from '../database/db.js';

describe('ScribeUserModel', () => {
  const model = new ScribeUserModel();

  beforeAll(() => { process.env.NODE_ENV = 'test'; });
  afterAll(() => closeDb());

  it('creates a new user and returns it', () => {
    const user = model.create({ email: 'a@test.com', passwordHash: 'hash1', name: 'Alice' });
    expect(user.id).toBeTruthy();
    expect(user.email).toBe('a@test.com');
    expect(user.name).toBe('Alice');
  });

  it('finds user by email', () => {
    const found = model.findByEmail('a@test.com');
    expect(found).not.toBeNull();
    expect(found!.email).toBe('a@test.com');
  });

  it('finds user by id', () => {
    const created = model.create({ email: 'b@test.com', passwordHash: 'hash2' });
    const found = model.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('returns null for unknown email', () => {
    expect(model.findByEmail('nobody@test.com')).toBeNull();
  });
});
