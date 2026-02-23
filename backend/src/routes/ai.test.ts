/**
 * Tests for chart-grounded chat endpoint (Task 7)
 *
 * Uses jest.spyOn on singleton exports (aiService, contextStore, ragService).
 * This works with ESM because we mutate the object's method slot, not the
 * live binding itself, so the spy is visible to the router module.
 */

import { createServer } from 'http';
import type { IncomingMessage } from 'http';
import express from 'express';

// Singleton imports – must be dynamic so diagnostics: false applies
// We import the router and singletons in beforeAll
let app: ReturnType<typeof express>;

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function httpPost(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
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
            ...headers,
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

// ── Singleton references (resolved in beforeAll) ──────────────────────────────
let aiService: any;
let contextStore: any;
let ragService: any;

beforeAll(async () => {
  // Dynamic imports so ts-jest diagnostics: false applies; modules resolve once
  const aiModule = await import('../services/ai/aiService.js');
  aiService = aiModule.aiService;

  const ctxModule = await import('../services/signal/contextStore.js');
  contextStore = ctxModule.contextStore;

  const ragModule = await import('../services/rag/ragService.js');
  ragService = ragModule.ragService;

  const aiRouter = (await import('./ai.js')).default;

  app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Chart-grounded chat endpoint', () => {
  let chatSpy: any;
  let contextStoreSpy: any;
  let ragSpy: any;

  beforeEach(() => {
    // Spy on singleton methods before each test
    chatSpy = jest.spyOn(aiService, 'chat').mockResolvedValue({
      content: 'mock response',
      model: 'mock',
      usage: {},
    });

    contextStoreSpy = jest.spyOn(contextStore, 'get').mockReturnValue(null);

    ragSpy = jest.spyOn(ragService, 'isAvailable').mockReturnValue(false);
    jest.spyOn(ragService, 'getIndexStats').mockReturnValue({ documentCount: 0, available: false });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cited: true when session has a cached Signal Engine timeline', async () => {
    // Arrange: contextStore returns a timeline with events
    contextStoreSpy.mockReturnValue({
      timeline: {
        events: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            type: 'vital',
            label: 'MAP',
            value: 65,
            unit: 'mmHg',
            isAbnormal: false,
          },
        ],
      },
      signals: {},
      cachedAt: new Date().toISOString(),
      patientId: 'patient-123',
    });

    chatSpy.mockResolvedValue({
      content: 'MAP is 65 mmHg [Source: Vital: MAP, 2024-01-15T10:00:00Z].',
      model: 'mock',
      usage: {},
    });

    const result = await httpPost(
      '/api/ai/chat',
      { messages: [{ role: 'user', content: 'What is the blood pressure?' }] },
      { 'x-session-id': 'test-session' }
    );

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('cited', true);
    expect(result.body).toHaveProperty('data');
  });

  it('returns cited: false when no cached timeline exists for the session', async () => {
    // contextStoreSpy already returns null (set in beforeEach)
    chatSpy.mockResolvedValue({
      content: 'No patient chart data is currently loaded.',
      model: 'mock',
      usage: {},
    });

    const result = await httpPost(
      '/api/ai/chat',
      { messages: [{ role: 'user', content: 'What is the blood pressure?' }] },
      { 'x-session-id': 'unknown-session' }
    );

    expect(result.status).toBe(200);
    expect(result.body).toHaveProperty('cited', false);
    expect(result.body).toHaveProperty('data');
  });

  it('returns 400 when messages array is empty', async () => {
    const result = await httpPost(
      '/api/ai/chat',
      { messages: [] },
      { 'x-session-id': 'test-session' }
    );

    expect(result.status).toBe(400);
    expect(result.body).toHaveProperty('error');
  });
});
