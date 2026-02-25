import { jest, describe, it, expect, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockFetch = jest.fn<typeof fetch>();
(globalThis as any).fetch = mockFetch;

import healthRouter from './health.js';

const app = express();
app.use(express.json());
app.use('/api', healthRouter);

function makeOkResponse() {
  return { ok: true, json: async () => ({ status: 'ok' }) } as unknown as Response;
}
function makeErrorResponse() {
  return { ok: false, status: 503 } as unknown as Response;
}

describe('GET /api/health', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('returns healthy when both Presidio services respond ok', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse())  // analyzer
      .mockResolvedValueOnce(makeOkResponse()); // anonymizer

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.presidio).toBe('healthy');
    expect(res.body.analyzer).toBe('ok');
    expect(res.body.anonymizer).toBe('ok');
  });

  it('returns degraded when analyzer is down', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(makeOkResponse());

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.presidio).toBe('degraded');
    expect(res.body.analyzer).toBe('unavailable');
    expect(res.body.anonymizer).toBe('ok');
  });

  it('returns degraded when anonymizer is down', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse())
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.presidio).toBe('degraded');
    expect(res.body.analyzer).toBe('ok');
    expect(res.body.anonymizer).toBe('unavailable');
  });

  it('returns degraded when both services are down', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.presidio).toBe('degraded');
    expect(res.body.analyzer).toBe('unavailable');
    expect(res.body.anonymizer).toBe('unavailable');
  });

  it('returns degraded when analyzer returns a non-ok HTTP status', async () => {
    mockFetch
      .mockResolvedValueOnce(makeErrorResponse())  // analyzer responds with 503
      .mockResolvedValueOnce(makeOkResponse());    // anonymizer is fine

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.presidio).toBe('degraded');
    expect(res.body.analyzer).toBe('unavailable');
    expect(res.body.anonymizer).toBe('ok');
  });
});
