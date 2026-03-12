import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock getPool before importing the middleware
const mockQuery = jest.fn<any>();
jest.unstable_mockModule('../database/db.js', () => ({
  getPool: () => ({ query: mockQuery }),
}));

const { scribeAuthMiddleware } = await import('./scribeAuth.js');

const SECRET = 'test-secret';

describe('scribeAuthMiddleware', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
    mockQuery.mockReset();
    // Default: user has no token_invalidated_at
    mockQuery.mockResolvedValue({ rows: [{ token_invalidated_at: null }] });
  });

  const mockRes = () => {
    const res = { status: jest.fn(), json: jest.fn() } as any;
    res.status.mockReturnValue(res);
    return res;
  };

  it('rejects request with no cookie', async () => {
    const req = { cookies: {} } as any;
    const next = jest.fn();
    await scribeAuthMiddleware(req, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid token', async () => {
    const req = { cookies: { scribe_token: 'bad' } } as any;
    const next = jest.fn();
    await scribeAuthMiddleware(req, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid JWT and sets req.scribeUserId', async () => {
    const token = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });
    const req = { cookies: { scribe_token: token } } as any;
    const next = jest.fn();
    await scribeAuthMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.scribeUserId).toBe('user-123');
  });

  it('rejects token issued before token_invalidated_at', async () => {
    // Token issued "now"
    const token = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });
    // But user invalidated tokens 1 second in the future
    const futureDate = new Date(Date.now() + 1000).toISOString();
    mockQuery.mockResolvedValue({ rows: [{ token_invalidated_at: futureDate }] });

    const req = { cookies: { scribe_token: token } } as any;
    const res = mockRes();
    const next = jest.fn();
    await scribeAuthMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts token issued after token_invalidated_at', async () => {
    // Invalidation happened 10 seconds ago
    const pastDate = new Date(Date.now() - 10000).toISOString();
    mockQuery.mockResolvedValue({ rows: [{ token_invalidated_at: pastDate }] });
    // Token issued now (after invalidation)
    const token = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });

    const req = { cookies: { scribe_token: token } } as any;
    const next = jest.fn();
    await scribeAuthMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
