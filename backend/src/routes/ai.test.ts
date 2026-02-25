/**
 * Tests for chart-grounded chat endpoint (Task 7)
 *
 * Uses jest.spyOn on singleton exports (aiService, contextStore, ragService).
 * This works with ESM because we mutate the object's method slot, not the
 * live binding itself, so the spy is visible to the router module.
 */

import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';

// Singleton imports – resolved in beforeAll
let app: ReturnType<typeof express>;

// ── Singleton references (resolved in beforeAll) ──────────────────────────────
let aiService: any;
let contextStore: any;
let ragService: any;

// ── PII spy references ────────────────────────────────────────────────────────
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;

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

  mockScrub = jest.spyOn(piiScrubber, 'scrub');
  mockReInject = jest.spyOn(piiScrubber, 'reInject');
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Chart-grounded chat endpoint', () => {
  let chatSpy: any;
  let contextStoreSpy: any;

  beforeEach(() => {
    // Spy on singleton methods before each test
    chatSpy = jest.spyOn(aiService, 'chat').mockResolvedValue({
      content: 'mock response',
      model: 'mock',
      usage: {},
    });

    contextStoreSpy = jest.spyOn(contextStore, 'get').mockReturnValue(null);

    jest.spyOn(ragService, 'isAvailable').mockReturnValue(false);
    jest.spyOn(ragService, 'getIndexStats').mockReturnValue({ documentCount: 0, available: false });

    // Default pass-through mocks — existing tests are unaffected by the PII layer
    mockScrub.mockImplementation(async (fields: any) => ({
      scrubbedFields: { ...fields },
      subMap: {},
    }));
    mockReInject.mockImplementation((text: any) => text);
  });

  afterEach(() => {
    chatSpy.mockRestore();
    contextStoreSpy.mockRestore();
    mockScrub.mockReset();
    mockReInject.mockReset();
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

    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-session-id', 'test-session')
      .send({ messages: [{ role: 'user', content: 'What is the blood pressure?' }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cited', true);
    expect(res.body).toHaveProperty('data');

    // Verify chart data was injected into the AI call
    const aiCallArgs = chatSpy.mock.calls[0]; // first call
    const patientContextArg = aiCallArgs[0]; // first arg is the ChatRequest object
    // The timeline event "MAP" should appear in the patientContext
    expect(JSON.stringify(patientContextArg)).toContain('MAP');
  });

  it('returns cited: false when no cached timeline exists for the session', async () => {
    // contextStoreSpy already returns null (set in beforeEach)
    chatSpy.mockResolvedValue({
      content: 'No patient chart data is currently loaded.',
      model: 'mock',
      usage: {},
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-session-id', 'unknown-session')
      .send({ messages: [{ role: 'user', content: 'What is the blood pressure?' }] });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cited', false);
    expect(res.body).toHaveProperty('data');
  });

  it('returns 400 when messages array is empty', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('x-session-id', 'test-session')
      .send({ messages: [] });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PII de-identification', () => {
  let chatSpy: any;

  beforeEach(() => {
    chatSpy = jest.spyOn(aiService, 'chat').mockResolvedValue({
      content: 'mock response',
      model: 'mock',
      usage: {},
    });

    jest.spyOn(contextStore, 'get').mockReturnValue(null);
    jest.spyOn(ragService, 'isAvailable').mockReturnValue(false);
    jest.spyOn(ragService, 'getIndexStats').mockReturnValue({ documentCount: 0, available: false });

    // Default pass-through mocks
    mockScrub.mockImplementation(async (fields: any) => ({
      scrubbedFields: { ...fields },
      subMap: {},
    }));
    mockReInject.mockImplementation((text: any) => text);
  });

  afterEach(() => {
    chatSpy.mockRestore();
    mockScrub.mockReset();
    mockReInject.mockReset();
  });

  it('calls piiScrubber.scrub with user message content before LLM call', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { message_0: '[PERSON_0] has a question.' },
      subMap: { '[PERSON_0]': 'John Smith' },
    } as any);
    mockReInject.mockImplementation((text: any) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    chatSpy.mockResolvedValue({
      content: '[PERSON_0] has a question.',
      model: 'mock',
      usage: {},
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'John Smith has a question.' }] });

    expect(res.status).toBe(200);
    expect(mockScrub).toHaveBeenCalledWith(
      expect.objectContaining({ message_0: 'John Smith has a question.' })
    );
  });

  it('returns 503 when Presidio is unavailable, never calls LLM', async () => {
    mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError() as any);

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'John Smith has a question.' }] });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/PII scrubbing/i);
    // Verify LLM was NOT called
    expect(chatSpy).not.toHaveBeenCalled();
  });

  it('re-injects PII values into response content before returning to client', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { message_0: '[PERSON_0] has a question.' },
      subMap: { '[PERSON_0]': 'John Smith' },
    } as any);
    mockReInject.mockImplementation((text: any) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    chatSpy.mockResolvedValue({
      content: 'Answer for [PERSON_0].',
      model: 'mock',
      usage: {},
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'John Smith has a question.' }] });

    expect(res.status).toBe(200);
    expect(mockReInject).toHaveBeenCalled();
    // Response should contain the real name, not the token
    expect(res.body.data.content).toContain('John Smith');
  });
});
