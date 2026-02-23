import jwt from 'jsonwebtoken';
import { scribeAuthMiddleware } from './scribeAuth.js';

const SECRET = 'test-secret';

describe('scribeAuthMiddleware', () => {
  beforeEach(() => { process.env.JWT_SECRET = SECRET; });

  const mockRes = () => {
    const res = { status: jest.fn(), json: jest.fn() } as any;
    res.status.mockReturnValue(res);
    return res;
  };

  it('rejects request with no cookie', () => {
    const req = { cookies: {} } as any;
    const next = jest.fn();
    scribeAuthMiddleware(req, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid token', () => {
    const req = { cookies: { scribe_token: 'bad' } } as any;
    const next = jest.fn();
    scribeAuthMiddleware(req, mockRes(), next);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid JWT and sets req.scribeUserId', () => {
    const token = jwt.sign({ userId: 'user-123' }, SECRET, { expiresIn: '7d' });
    const req = { cookies: { scribe_token: token } } as any;
    const next = jest.fn();
    scribeAuthMiddleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.scribeUserId).toBe('user-123');
  });
});
