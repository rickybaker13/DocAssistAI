/**
 * Tests for Population Query Engine stub routes (Task 9)
 *
 * Follows the same HTTP helper pattern as ai.test.ts — uses Node's built-in
 * http module so supertest is not required.
 */

import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import express from 'express';

let app: ReturnType<typeof express>;

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function httpPost(
  path: string,
  body: unknown
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      const port = addr.port;
      const bodyStr = JSON.stringify(body);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const req = require('http').request(
        {
          hostname: 'localhost',
          port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr).toString(),
          },
        },
        (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 500, body: {} });
            }
          });
        }
      );
      req.on('error', (err: Error) => { server.close(); reject(err); });
      req.write(bodyStr);
      req.end();
    });
  });
}

async function httpGet(
  path: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      const port = addr.port;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const req = require('http').request(
        {
          hostname: 'localhost',
          port,
          path,
          method: 'GET',
        },
        (res: IncomingMessage) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            server.close();
            try {
              resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
            } catch {
              resolve({ status: res.statusCode ?? 500, body: {} });
            }
          });
        }
      );
      req.on('error', (err: Error) => { server.close(); reject(err); });
      req.end();
    });
  });
}

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const populationRouter = (await import('./population.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/population', populationRouter);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Population Query Engine routes', () => {
  it('POST /api/population/query returns 501', async () => {
    const res = await httpPost('/api/population/query', {
      naturalLanguageQuery: 'What is the MRSA rate?',
      role: 'quality',
    });
    expect(res.status).toBe(501);
    expect(res.body).toHaveProperty('roadmap');
    expect(res.body).toHaveProperty('plannedCapabilities');
    expect(Array.isArray(res.body.plannedCapabilities)).toBe(true);
  });

  it('GET /api/population/status returns not_implemented', async () => {
    const res = await httpGet('/api/population/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('not_implemented');
  });
});
