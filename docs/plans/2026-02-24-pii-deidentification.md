# PII De-Identification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Microsoft Presidio-backed PII de-identification to every LLM call so no PHI is ever transmitted to the Claude API.

**Architecture:** Docker Compose sidecar — `presidio-analyzer` and `presidio-anonymizer` containers run alongside Express. `piiScrubber.ts` calls Presidio Analyzer over REST, builds a request-scoped substitution map (`[PERSON_0]`, `[DATE_0]`, etc.), replaces entity spans with typed tokens, then re-injects original values into the LLM response before returning to client. Fail-closed everywhere: 503 if Presidio unreachable, LLM never called.

**Tech Stack:** Node 18+ native `fetch` (no new runtime deps), `AbortController` for timeouts, Jest ESM `(globalThis as any).fetch = mockFetch` pattern for unit tests, `jest.spyOn(piiScrubber, 'scrub')` for integration tests, Docker Compose with official Microsoft Container Registry images.

---

## Task 1: Infrastructure — docker-compose.yml + YAML recognizers + env vars

**Files:**
- Create: `docker-compose.yml` (project root)
- Create: `backend/presidio-config/custom-recognizers.yaml`
- Modify: `backend/.env.example`

---

**Step 1: Create `docker-compose.yml` at the project root**

```yaml
services:
  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
    ports: ["5002:3000"]
    volumes:
      - ./backend/presidio-config:/usr/bin/presidio/conf
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      retries: 5
      start_period: 30s

  presidio-anonymizer:
    image: mcr.microsoft.com/presidio-anonymizer:latest
    ports: ["5001:3000"]
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      retries: 3
      start_period: 20s

  backend:
    build: ./backend
    ports: ["3000:3000"]
    depends_on:
      presidio-analyzer:
        condition: service_healthy
      presidio-anonymizer:
        condition: service_healthy
    environment:
      - PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000
      - PRESIDIO_ANONYMIZER_URL=http://presidio-anonymizer:3000
      - PRESIDIO_MIN_SCORE=0.7
      - PRESIDIO_TIMEOUT_MS=5000
```

---

**Step 2: Create `backend/presidio-config/custom-recognizers.yaml`**

```yaml
# HIPAA identifiers not natively covered by Presidio base models
---
recognizers:
  - name: MedicalRecordNumberRecognizer
    supported_language: en
    patterns:
      - name: mrn_pattern
        regex: "MRN[\\s#:]*[A-Z0-9]{4,12}"
        score: 0.85
    context:
      - "mrn"
      - "medical record"
      - "record number"
      - "chart number"
    supported_entity: MEDICAL_RECORD_NUMBER

  - name: DateOfBirthRecognizer
    supported_language: en
    patterns:
      - name: dob_pattern
        regex: "DOB[\\s:]*\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4}"
        score: 0.9
      - name: dob_full_pattern
        regex: "(?:date of birth|born on)[:\\s]*\\d{1,2}[/\\-]\\d{1,2}[/\\-]\\d{2,4}"
        score: 0.85
    supported_entity: DATE_OF_BIRTH

  - name: HealthPlanNumberRecognizer
    supported_language: en
    patterns:
      - name: plan_pattern
        regex: "[A-Z]{2,3}[\\s\\-]?\\d{6,12}"
        score: 0.6
    context:
      - "insurance"
      - "health plan"
      - "policy"
      - "member id"
      - "subscriber"
    supported_entity: HEALTH_PLAN_NUMBER

  - name: AccountNumberRecognizer
    supported_language: en
    patterns:
      - name: account_pattern
        regex: "(?:account|acct)[\\s#:]*[A-Z0-9\\-]{4,16}"
        score: 0.75
    supported_entity: ACCOUNT_NUMBER

  - name: AgeOver89Recognizer
    supported_language: en
    patterns:
      - name: age_pattern
        regex: "\\b(9[0-9]|1[0-9]{2})\\s*(?:year|yr)"
        score: 0.8
    context:
      - "age"
      - "year old"
      - "yr old"
      - "years of age"
    supported_entity: AGE_OVER_89
```

---

**Step 3: Add env vars to `backend/.env.example`**

Append to `backend/.env.example`:
```
# PII De-identification (Microsoft Presidio)
PRESIDIO_ANALYZER_URL=http://localhost:5002
PRESIDIO_ANONYMIZER_URL=http://localhost:5001
PRESIDIO_MIN_SCORE=0.7
PRESIDIO_TIMEOUT_MS=5000
```

---

**Step 4: Commit**

```bash
git add docker-compose.yml backend/presidio-config/ backend/.env.example
git commit -m "feat: add Docker Compose + Presidio infrastructure and custom HIPAA recognizers"
```

---

## Task 2: Core service TDD — piiScrubber.ts

**Files:**
- Create: `backend/src/services/piiScrubber.test.ts`
- Create: `backend/src/services/piiScrubber.ts`

---

**Step 1: Write the failing tests**

Create `backend/src/services/piiScrubber.test.ts`:

```typescript
import { jest, describe, it, expect, afterEach } from '@jest/globals';

// Mock globalThis.fetch BEFORE importing the module under test
const mockFetch = jest.fn<typeof fetch>();
(globalThis as any).fetch = mockFetch;

import { piiScrubber, PiiServiceUnavailableError } from './piiScrubber.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyzerResponse(results: object[]) {
  return {
    ok: true,
    json: async () => results,
  } as unknown as Response;
}

function makeAnalyzerError(status = 503) {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'Service unavailable' }),
  } as unknown as Response;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('piiScrubber', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  // ── scrub() ──────────────────────────────────────────────────────────────

  describe('scrub()', () => {
    it('scrubs a PERSON entity and builds the correct subMap', async () => {
      // "John Smith" occupies positions 11-21 in "Patient is John Smith today."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 11, end: 21, score: 0.95 },
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'Patient is John Smith today.',
      });

      expect(scrubbedFields.transcript).toBe('Patient is [PERSON_0] today.');
      expect(subMap['[PERSON_0]']).toBe('John Smith');
    });

    it('assigns unique numbered tokens to different values of the same entity type', async () => {
      // "John Smith" at 0-10, "Dr. Adams" at 15-24 in "John Smith saw Dr. Adams."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        { entity_type: 'PERSON', start: 15, end: 24, score: 0.90 },
      ]));

      const { subMap } = await piiScrubber.scrub({
        transcript: 'John Smith saw Dr. Adams.',
      });

      expect(Object.keys(subMap)).toHaveLength(2);
      expect(subMap['[PERSON_0]']).toBe('John Smith');
      expect(subMap['[PERSON_1]']).toBe('Dr. Adams');
    });

    it('assigns the same token when the same value appears twice', async () => {
      // "John Smith" at 0-10 and 17-27 in "John Smith here. John Smith again."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        { entity_type: 'PERSON', start: 17, end: 27, score: 0.90 },
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'John Smith here. John Smith again.',
      });

      expect(Object.keys(subMap)).toHaveLength(1);
      expect(subMap['[PERSON_0]']).toBe('John Smith');
      expect(scrubbedFields.transcript).toBe('[PERSON_0] here. [PERSON_0] again.');
    });

    it('replaces spans in reverse order to preserve correct character indices', async () => {
      // "Jane" at 0-4, "03/15/1965" at 14-24 in "Jane admitted 03/15/1965."
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 4, score: 0.95 },
        { entity_type: 'DATE_TIME', start: 14, end: 24, score: 0.90 },
      ]));

      const { scrubbedFields } = await piiScrubber.scrub({
        transcript: 'Jane admitted 03/15/1965.',
      });

      expect(scrubbedFields.transcript).toBe('[PERSON_0] admitted [DATE_TIME_0].');
    });

    it('skips entities below PRESIDIO_MIN_SCORE threshold', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerResponse([
        { entity_type: 'PERSON', start: 0, end: 10, score: 0.5 }, // below 0.7 → skip
        { entity_type: 'DATE_TIME', start: 14, end: 24, score: 0.9 }, // above → redact
      ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'John Smith on 01/01/2000.',
      });

      // Low-confidence PERSON is NOT redacted
      expect(scrubbedFields.transcript).toContain('John Smith');
      // High-confidence DATE is redacted
      expect(Object.keys(subMap)).toHaveLength(1);
    });

    it('scrubs multiple fields and shares one subMap (same value → same token across fields)', async () => {
      // field1: "John Smith" at 0-10; field2: "John Smith" at 11-21
      mockFetch
        .mockResolvedValueOnce(makeAnalyzerResponse([
          { entity_type: 'PERSON', start: 0, end: 10, score: 0.95 },
        ]))
        .mockResolvedValueOnce(makeAnalyzerResponse([
          { entity_type: 'PERSON', start: 11, end: 21, score: 0.90 },
        ]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        field1: 'John Smith is the patient.',
        field2: 'Patient is John Smith.',
      });

      // Same value in both fields → same token
      expect(scrubbedFields.field1).toContain('[PERSON_0]');
      expect(scrubbedFields.field2).toContain('[PERSON_0]');
      expect(Object.keys(subMap)).toHaveLength(1);
    });

    it('handles empty string input gracefully without calling Presidio', async () => {
      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: '',
      });

      expect(scrubbedFields.transcript).toBe('');
      expect(Object.keys(subMap)).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles text with no PII detected', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerResponse([]));

      const { scrubbedFields, subMap } = await piiScrubber.scrub({
        transcript: 'Blood pressure was elevated.',
      });

      expect(scrubbedFields.transcript).toBe('Blood pressure was elevated.');
      expect(Object.keys(subMap)).toHaveLength(0);
    });

    it('throws PiiServiceUnavailableError when Presidio returns a non-ok status', async () => {
      mockFetch.mockResolvedValue(makeAnalyzerError(503));

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });

    it('throws PiiServiceUnavailableError when fetch throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });

    it('throws PiiServiceUnavailableError when fetch is aborted (timeout)', async () => {
      const abortErr = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      mockFetch.mockRejectedValue(abortErr);

      await expect(
        piiScrubber.scrub({ transcript: 'John Smith.' })
      ).rejects.toThrow(PiiServiceUnavailableError);
    });
  });

  // ── reInject() ────────────────────────────────────────────────────────────

  describe('reInject()', () => {
    it('restores all tokens to their original values', () => {
      const subMap = {
        '[PERSON_0]': 'John Smith',
        '[DATE_TIME_0]': '03/15/1965',
        '[MEDICAL_RECORD_NUMBER_0]': 'MRN#89234',
      };
      const text = 'Patient [PERSON_0] born [DATE_TIME_0] with chart [MEDICAL_RECORD_NUMBER_0].';

      expect(piiScrubber.reInject(text, subMap)).toBe(
        'Patient John Smith born 03/15/1965 with chart MRN#89234.'
      );
    });

    it('replaces all occurrences of the same token', () => {
      const subMap = { '[PERSON_0]': 'Dr. Adams' };
      const text = '[PERSON_0] consulted with [PERSON_0] by phone.';

      expect(piiScrubber.reInject(text, subMap)).toBe(
        'Dr. Adams consulted with Dr. Adams by phone.'
      );
    });

    it('returns text unchanged when subMap is empty', () => {
      const text = 'No tokens here.';
      expect(piiScrubber.reInject(text, {})).toBe(text);
    });
  });
});
```

---

**Step 2: Run tests to verify they fail**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="piiScrubber" --no-coverage
```

Expected output: Multiple test failures — `Cannot find module './piiScrubber.js'`

---

**Step 3: Create `backend/src/services/piiScrubber.ts`**

```typescript
// backend/src/services/piiScrubber.ts

export interface AnalyzerResult {
  entity_type: string;
  start: number;
  end: number;
  score: number;
}

export type SubstitutionMap = Record<string, string>; // token → original value

export interface ScrubResult {
  scrubbedFields: Record<string, string>;
  subMap: SubstitutionMap;
}

export class PiiServiceUnavailableError extends Error {
  constructor(message?: string) {
    super(
      message ??
        'PII scrubbing service unavailable. Patient data cannot be sent to AI until de-identification is restored.'
    );
    this.name = 'PiiServiceUnavailableError';
  }
}

const UNAVAILABLE_MSG =
  'PII scrubbing service unavailable. Patient data cannot be sent to AI until de-identification is restored.';

// ── Internal: call Presidio Analyzer ─────────────────────────────────────────

async function analyzeText(text: string): Promise<AnalyzerResult[]> {
  const analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
  const timeoutMs = parseInt(process.env.PRESIDIO_TIMEOUT_MS || '5000', 10);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${analyzerUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'en' }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new PiiServiceUnavailableError(UNAVAILABLE_MSG);
    }

    return response.json() as Promise<AnalyzerResult[]>;
  } catch (err: any) {
    if (err instanceof PiiServiceUnavailableError) throw err;
    // Network errors, AbortError (timeout), parse errors
    throw new PiiServiceUnavailableError(UNAVAILABLE_MSG);
  } finally {
    clearTimeout(timer);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Scrub PII from all fields. One shared subMap spans all fields so the same
 * original value always maps to the same token regardless of which field it
 * appears in. Throws PiiServiceUnavailableError if Presidio is unreachable.
 */
async function scrub(fields: Record<string, string>): Promise<ScrubResult> {
  const minScore = parseFloat(process.env.PRESIDIO_MIN_SCORE || '0.7');
  const subMap: SubstitutionMap = {};
  const valueToToken = new Map<string, string>(); // dedup: same value → same token
  const typeCounts: Record<string, number> = {};
  const scrubbedFields: Record<string, string> = {};

  for (const [fieldName, text] of Object.entries(fields)) {
    if (!text) {
      scrubbedFields[fieldName] = text;
      continue;
    }

    const results = await analyzeText(text); // throws PiiServiceUnavailableError on failure

    // Filter by confidence; sort descending by start for safe reverse replacement
    const filtered = results
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.start - a.start);

    let scrubbed = text;
    for (const entity of filtered) {
      const originalValue = text.slice(entity.start, entity.end); // always from original text

      // Reuse token if we've seen this exact value before
      let token = valueToToken.get(originalValue);
      if (!token) {
        const count = typeCounts[entity.entity_type] ?? 0;
        token = `[${entity.entity_type}_${count}]`;
        typeCounts[entity.entity_type] = count + 1;
        valueToToken.set(originalValue, token);
        subMap[token] = originalValue;
      }

      // Replace span in the working string (reverse order keeps earlier indices valid)
      scrubbed = scrubbed.slice(0, entity.start) + token + scrubbed.slice(entity.end);
    }

    scrubbedFields[fieldName] = scrubbed;
  }

  return { scrubbedFields, subMap };
}

/**
 * Re-inject original values into LLM response text. Pure synchronous function —
 * no I/O, no side effects. Replaces every occurrence of each token globally.
 */
function reInject(text: string, subMap: SubstitutionMap): string {
  let result = text;
  for (const [token, original] of Object.entries(subMap)) {
    // Escape [ and ] since they are regex metacharacters
    const escaped = token.replace(/[[\]]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), original);
  }
  return result;
}

// Singleton export — enables jest.spyOn(piiScrubber, 'scrub') in tests
export const piiScrubber = { scrub, reInject };
```

---

**Step 4: Run tests to verify they all pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="piiScrubber" --no-coverage
```

Expected: 12/12 tests PASS

---

**Step 5: Commit**

```bash
git add backend/src/services/piiScrubber.ts backend/src/services/piiScrubber.test.ts
git commit -m "feat: add piiScrubber service with Presidio Analyzer integration and 12 unit tests"
```

---

## Task 3: Health endpoint TDD

**Files:**
- Create: `backend/src/routes/health.ts`
- Create: `backend/src/routes/health.test.ts`
- Modify: `backend/src/server.ts` (add import + mount)

---

**Step 1: Write the failing tests**

Create `backend/src/routes/health.test.ts`:

```typescript
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
});
```

---

**Step 2: Run tests to verify they fail**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="routes/health" --no-coverage
```

Expected: FAIL — `Cannot find module './health.js'`

---

**Step 3: Create `backend/src/routes/health.ts`**

```typescript
import { Router, Request, Response } from 'express';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://localhost:5002';
  const anonymizerUrl = process.env.PRESIDIO_ANONYMIZER_URL || 'http://localhost:5001';
  const timeoutMs = 3000;

  async function checkService(url: string): Promise<'ok' | 'unavailable'> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(`${url}/health`, { signal: controller.signal });
      return resp.ok ? 'ok' : 'unavailable';
    } catch {
      return 'unavailable';
    } finally {
      clearTimeout(timer);
    }
  }

  const [analyzer, anonymizer] = await Promise.all([
    checkService(analyzerUrl),
    checkService(anonymizerUrl),
  ]);

  const presidio = analyzer === 'ok' && anonymizer === 'ok' ? 'healthy' : 'degraded';

  res.json({ presidio, analyzer, anonymizer });
});

export default router;
```

---

**Step 4: Mount the health route in `backend/src/server.ts`**

Add import (near the other route imports at the top):
```typescript
import healthRouter from './routes/health.js';
```

Add mount (near the other `app.use` route registrations):
```typescript
app.use('/api', healthRouter);
```

---

**Step 5: Run health tests to verify they pass**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="routes/health" --no-coverage
```

Expected: 4/4 tests PASS

---

**Step 6: Commit**

```bash
git add backend/src/routes/health.ts backend/src/routes/health.test.ts backend/src/server.ts
git commit -m "feat: add GET /api/health endpoint with Presidio service status check"
```

---

## Task 4: scribeAi.ts integration TDD

**Files:**
- Modify: `backend/src/routes/scribeAi.ts`
- Modify: `backend/src/routes/scribeAi.test.ts`

---

**Step 1: Write new failing tests in `scribeAi.test.ts`**

**At the top of the file**, add this import (after the existing imports):
```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
```

**In the `describe('Scribe AI Routes', ...)` block**, add these declarations after `let mockAiChat`:
```typescript
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;
```

**In `beforeAll`**, after `mockAiChat = jest.spyOn(aiService, 'chat')`:
```typescript
mockScrub = jest.spyOn(piiScrubber, 'scrub');
mockReInject = jest.spyOn(piiScrubber, 'reInject');
```

**Add a `beforeEach` block** (new, after the existing `afterEach`):
```typescript
// Default pass-through mocks so existing tests are unaffected by the PII layer
beforeEach(() => {
  mockScrub.mockImplementation(async (fields) => ({
    scrubbedFields: { ...fields },
    subMap: {},
  }));
  mockReInject.mockImplementation((text) => text);
});
```

**Update `afterEach`** to also reset the PII mocks:
```typescript
afterEach(() => {
  mockAiChat.mockReset();
  mockScrub.mockReset();
  mockReInject.mockReset();
});
```

**Add this entire new `describe` block** at the end of the outer `describe('Scribe AI Routes', ...)`, after all existing describe blocks:

```typescript
describe('PII de-identification', () => {
  it('/generate — calls piiScrubber.scrub with transcript before LLM call', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { transcript: 'Patient is [PERSON_0].' },
      subMap: { '[PERSON_0]': 'John Smith' },
    });
    mockReInject.mockImplementation((text) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        sections: [{ name: 'HPI', content: '[PERSON_0] has chest pain.', confidence: 0.9 }],
      }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/generate')
      .set('Cookie', authCookie)
      .send({
        transcript: 'Patient is John Smith.',
        sections: [{ name: 'HPI' }],
        noteType: 'progress_note',
      });

    expect(res.status).toBe(200);
    // scrub was called with the original transcript
    expect(mockScrub).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: 'Patient is John Smith.' })
    );
    // LLM received scrubbed text (not the real name)
    const userMsg: string =
      (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'user')?.content ?? '';
    expect(userMsg).toContain('[PERSON_0]');
    expect(userMsg).not.toContain('John Smith');
    // Real name is restored in the response
    expect(res.body.sections[0].content).toContain('John Smith');
  });

  it('/generate — returns 503 when Presidio is unavailable, never calls LLM', async () => {
    mockScrub.mockRejectedValueOnce(
      new PiiServiceUnavailableError()
    );

    const res = await request(app)
      .post('/api/ai/scribe/generate')
      .set('Cookie', authCookie)
      .send({
        transcript: 'Patient is John Smith.',
        sections: [{ name: 'HPI' }],
        noteType: 'progress_note',
      });

    expect(res.status).toBe(503);
    expect(mockAiChat).not.toHaveBeenCalled();
    expect(res.body.error).toMatch(/PII scrubbing/i);
  });

  it('/ghost-write — scrubs chatAnswer and existingContent, re-injects into ghostWritten', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { chatAnswer: '[PERSON_0] on lisinopril.', existingContent: '' },
      subMap: { '[PERSON_0]': 'John Smith' },
    });
    mockReInject.mockImplementation((text) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    mockAiChat.mockResolvedValueOnce({ content: '[PERSON_0] on lisinopril.' } as any);

    const res = await request(app)
      .post('/api/ai/scribe/ghost-write')
      .set('Cookie', authCookie)
      .send({
        chatAnswer: 'John Smith on lisinopril.',
        destinationSection: 'Assessment',
        existingContent: '',
      });

    expect(res.status).toBe(200);
    expect(mockScrub).toHaveBeenCalledWith(
      expect.objectContaining({ chatAnswer: 'John Smith on lisinopril.' })
    );
    expect(mockReInject).toHaveBeenCalled();
    expect(res.body.ghostWritten).toContain('John Smith');
  });

  it('/ghost-write — returns 503 when Presidio is unavailable', async () => {
    mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

    const res = await request(app)
      .post('/api/ai/scribe/ghost-write')
      .set('Cookie', authCookie)
      .send({
        chatAnswer: 'John Smith on lisinopril.',
        destinationSection: 'Assessment',
      });

    expect(res.status).toBe(503);
    expect(mockAiChat).not.toHaveBeenCalled();
  });

  it('/focused — scrubs content and transcript, re-injects into analysis', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: { content: '[PERSON_0] with HTN.', transcript: '' },
      subMap: { '[PERSON_0]': 'John Smith' },
    });
    mockReInject.mockImplementation((text) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        analysis: '[PERSON_0] has essential hypertension.',
        citations: [],
        suggestions: ['Add medication list.'],
        confidence_breakdown: '',
      }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/focused')
      .set('Cookie', authCookie)
      .send({ sectionName: 'Assessment', content: 'John Smith with HTN.', transcript: '' });

    expect(res.status).toBe(200);
    expect(mockScrub).toHaveBeenCalled();
    expect(res.body.analysis).toContain('John Smith');
  });

  it('/resolve-suggestion — scrubs suggestion/existingContent/transcript, re-injects into noteText', async () => {
    mockScrub.mockResolvedValueOnce({
      scrubbedFields: {
        suggestion: 'Document BP for [PERSON_0].',
        existingContent: '',
        transcript: '',
      },
      subMap: { '[PERSON_0]': 'John Smith' },
    });
    mockReInject.mockImplementation((text) =>
      text.replace(/\[PERSON_0\]/g, 'John Smith')
    );
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({ ready: true, noteText: '[PERSON_0]: BP 140/90.' }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .set('Cookie', authCookie)
      .send({
        suggestion: 'Document BP for John Smith.',
        sectionName: 'Assessment',
        existingContent: '',
        transcript: '',
      });

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(res.body.noteText).toContain('John Smith');
  });

  it('/resolve-suggestion — returns 503 when Presidio is unavailable', async () => {
    mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .set('Cookie', authCookie)
      .send({
        suggestion: 'Document BP for John Smith.',
        sectionName: 'Assessment',
      });

    expect(res.status).toBe(503);
    expect(mockAiChat).not.toHaveBeenCalled();
  });

  it('system prompt includes token-preservation instruction on /generate', async () => {
    mockScrub.mockResolvedValueOnce({ scrubbedFields: { transcript: 'text' }, subMap: {} });
    mockReInject.mockImplementation((text) => text);
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        sections: [{ name: 'HPI', content: 'text', confidence: 0.9 }],
      }),
    } as any);

    await request(app)
      .post('/api/ai/scribe/generate')
      .set('Cookie', authCookie)
      .send({ transcript: 'text', sections: [{ name: 'HPI' }], noteType: 'progress_note' });

    const sys: string =
      (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
    expect(sys).toMatch(/privacy-protection token|TOKEN_N|BRACKET_N/i);
  });
});
```

---

**Step 2: Run tests to verify the new ones fail**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage
```

Expected: The 8 new PII tests FAIL. The existing 22 tests should still PASS.

---

**Step 3: Modify `backend/src/routes/scribeAi.ts`**

**Add import** at the top (after existing imports):
```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
```

**Add constant** after `ICD10_TERMINOLOGY_INSTRUCTION`:
```typescript
const TOKEN_PRESERVATION_INSTRUCTION = `\nText may contain privacy-protection tokens in [TOKEN_N] format (e.g., [PERSON_0], [DATE_0], [MRN_0]). Preserve these tokens exactly as written — do not rephrase, remove, or modify any [BRACKET_N] token.`;
```

---

**Modify `/generate` handler** — add PII scrubbing after the validation block and before prompt construction:

```typescript
// ── PII De-identification ─────────────────────────────────────────────────
let scrubbedTranscript = transcript;
let subMap: Record<string, string> = {};
try {
  const result = await piiScrubber.scrub({ transcript });
  scrubbedTranscript = result.scrubbedFields.transcript;
  subMap = result.subMap;
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ error: (err as Error).message }) as any;
  }
  throw err;
}
```

Replace `"${transcript}"` in `userPrompt` with `"${scrubbedTranscript}"`.

Append `${TOKEN_PRESERVATION_INSTRUCTION}` to `systemPrompt` (inside the template literal, before the closing backtick).

After parsing the LLM response sections, add reInject:
```typescript
if (Object.keys(subMap).length > 0) {
  parsed.sections = parsed.sections.map((s: any) => ({
    ...s,
    content: piiScrubber.reInject(s.content ?? '', subMap),
  }));
}
```

---

**Modify `/focused` handler** — add PII scrubbing after the validation block:

```typescript
// ── PII De-identification ─────────────────────────────────────────────────
let scrubbedContent = content;
let scrubbedTranscriptFocused = transcript ?? '';
let subMapFocused: Record<string, string> = {};
try {
  const result = await piiScrubber.scrub({
    content,
    transcript: transcript ?? '',
  });
  scrubbedContent = result.scrubbedFields.content;
  scrubbedTranscriptFocused = result.scrubbedFields.transcript;
  subMapFocused = result.subMap;
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ error: (err as Error).message }) as any;
  }
  throw err;
}
```

Replace `${content}` and `${transcript}` in `userPrompt` with `${scrubbedContent}` and `${scrubbedTranscriptFocused}`.

Append `${TOKEN_PRESERVATION_INSTRUCTION}` to `systemPrompt`.

After parsing, add reInject:
```typescript
if (Object.keys(subMapFocused).length > 0) {
  if (parsed.analysis) {
    parsed.analysis = piiScrubber.reInject(parsed.analysis, subMapFocused);
  }
  if (Array.isArray(parsed.suggestions)) {
    parsed.suggestions = parsed.suggestions.map((s: string) =>
      piiScrubber.reInject(s, subMapFocused)
    );
  }
}
```

---

**Modify `/ghost-write` handler** — add PII scrubbing after the validation block:

```typescript
// ── PII De-identification ─────────────────────────────────────────────────
let scrubbedChatAnswer = chatAnswer;
let scrubbedExistingContent = existingContent ?? '';
let subMapGhost: Record<string, string> = {};
try {
  const result = await piiScrubber.scrub({
    chatAnswer,
    existingContent: existingContent ?? '',
  });
  scrubbedChatAnswer = result.scrubbedFields.chatAnswer;
  scrubbedExistingContent = result.scrubbedFields.existingContent;
  subMapGhost = result.subMap;
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ error: (err as Error).message }) as any;
  }
  throw err;
}
```

Replace `${chatAnswer}` and `${existingContent}` in `userPrompt` with `${scrubbedChatAnswer}` and `${scrubbedExistingContent}`.

Append `${TOKEN_PRESERVATION_INSTRUCTION}` to `systemPrompt`.

Replace the `ghostWritten` extraction line with:
```typescript
const ghostWritten = piiScrubber.reInject(extractContent(raw).trim(), subMapGhost);
```

---

**Modify `/resolve-suggestion` handler** — add PII scrubbing after the validation block:

```typescript
// ── PII De-identification ─────────────────────────────────────────────────
let scrubbedSuggestion = suggestion;
let scrubbedExistingContentRS = existingContent;
let scrubbedTranscriptRS = transcript;
let subMapRS: Record<string, string> = {};
try {
  const result = await piiScrubber.scrub({
    suggestion,
    existingContent,
    transcript,
  });
  scrubbedSuggestion = result.scrubbedFields.suggestion;
  scrubbedExistingContentRS = result.scrubbedFields.existingContent;
  scrubbedTranscriptRS = result.scrubbedFields.transcript;
  subMapRS = result.subMap;
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ error: (err as Error).message }) as any;
  }
  throw err;
}
```

Replace `${suggestion}`, `${existingContent}`, and `${transcript}` in `userPrompt` with `${scrubbedSuggestion}`, `${scrubbedExistingContentRS}`, and `${scrubbedTranscriptRS}`.

Append `${TOKEN_PRESERVATION_INSTRUCTION}` to `systemPrompt`.

After the runtime shape validation block, add reInject before `return res.json(parsed)`:
```typescript
if (Object.keys(subMapRS).length > 0) {
  if (parsed.noteText) {
    parsed.noteText = piiScrubber.reInject(parsed.noteText, subMapRS);
  }
  if (parsed.question) {
    parsed.question = piiScrubber.reInject(parsed.question, subMapRS);
  }
}
```

---

**Step 4: Run all scribeAi tests**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage
```

Expected: All 30 tests PASS (22 existing + 8 new PII tests).

---

**Step 5: Commit**

```bash
git add backend/src/routes/scribeAi.ts backend/src/routes/scribeAi.test.ts
git commit -m "feat: integrate piiScrubber into all four scribeAi endpoints with 8 integration tests"
```

---

## Task 5: Chat endpoint PII integration

**Files:**
- Modify: `backend/src/routes/ai.ts`

Note: `ai.ts` is a complex file with Signal Engine, RAG, and audit logging. The PII scrubbing targets `messages[].content` (user role only) and the original `req.body.patientContext`. The Signal Engine chart context and RAG context are out of scope for V1 (noted as known gap in the design doc).

---

**Step 1: Add the import to `backend/src/routes/ai.ts`**

Add after existing imports:
```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
```

---

**Step 2: Add PII scrubbing block in `POST /chat`**

Insert after the validation block (`if (!request.messages || request.messages.length === 0)`), before the Signal Engine section:

```typescript
// ── PII De-identification ─────────────────────────────────────────────────
// Scrub user messages and patient context. Signal Engine chart context is
// structured FHIR data and addressed in V2 with a clinical NER model.
const fieldsToScrub: Record<string, string> = {};
request.messages.forEach((msg, i) => {
  if (msg.role === 'user' && msg.content) {
    fieldsToScrub[`message_${i}`] = msg.content;
  }
});
if (req.body.patientContext) {
  fieldsToScrub.patientContext = req.body.patientContext;
}

let chatSubMap: Record<string, string> = {};
if (Object.keys(fieldsToScrub).length > 0) {
  let scrubResult: { scrubbedFields: Record<string, string>; subMap: Record<string, string> };
  try {
    scrubResult = await piiScrubber.scrub(fieldsToScrub);
  } catch (err) {
    if (err instanceof PiiServiceUnavailableError) {
      return res.status(503).json({
        success: false,
        error: (err as Error).message,
      });
    }
    throw err;
  }
  chatSubMap = scrubResult.subMap;

  // Apply scrubbed user message content
  request.messages = request.messages.map((msg, i) => {
    const key = `message_${i}`;
    if (msg.role === 'user' && scrubResult.scrubbedFields[key] !== undefined) {
      return { ...msg, content: scrubResult.scrubbedFields[key] };
    }
    return msg;
  });
}
```

---

**Step 3: Re-inject into the response before `res.json()`**

Replace:
```typescript
res.json({
  success: true,
  cited,
  data: response,
});
```

With:
```typescript
// Re-inject original PII values before returning to client
const responseData =
  Object.keys(chatSubMap).length > 0 && response.content
    ? { ...response, content: piiScrubber.reInject(response.content, chatSubMap) }
    : response;

res.json({
  success: true,
  cited,
  data: responseData,
});
```

---

**Step 4: Run all backend tests**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: All tests pass.

---

**Step 5: Commit**

```bash
git add backend/src/routes/ai.ts
git commit -m "feat: integrate piiScrubber into chat endpoint (user messages + patientContext)"
```

---

## Task 6: CLAUDE.md update + full test run + push

**Files:**
- Modify: `CLAUDE.md`

---

**Step 1: Run the full backend test suite one final time**

```bash
cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage
```

Expected: All tests pass. Check the count — should be at least 34+ tests total (existing + 12 piiScrubber unit + 4 health + 8 scribeAi PII).

---

**Step 2: Add a PII De-identification section to `CLAUDE.md`**

Add after the `## CMS/ICD-10 Terminology Feature` section:

```markdown
## PII De-Identification Layer

**Architecture:** Microsoft Presidio sidecar via Docker Compose. `backend/src/services/piiScrubber.ts` intercepts all text fields before every LLM call. PHI is replaced with typed tokens (`[PERSON_0]`, `[DATE_TIME_0]`, `[MEDICAL_RECORD_NUMBER_0]`, etc.). Backend holds a request-scoped substitution map (never persisted, never logged). Re-injection restores real values in LLM response before client receives it.

**Fail behavior:** Fail closed always — 503 returned to client, LLM never called if Presidio unreachable.

**Start Presidio locally (required for backend to serve LLM requests):**
```bash
docker-compose up presidio-analyzer presidio-anonymizer
```

**Environment variables:**
- `PRESIDIO_ANALYZER_URL` — default `http://localhost:5002`
- `PRESIDIO_ANONYMIZER_URL` — default `http://localhost:5001`
- `PRESIDIO_MIN_SCORE` — confidence threshold (default `0.7`). Low-confidence detections skipped — prefer missing uncertain PII over corrupting clinical content.
- `PRESIDIO_TIMEOUT_MS` — per-request timeout (default `5000`)

**Testing pattern for `piiScrubber.test.ts`:**
Mock fetch before importing the module:
```typescript
const mockFetch = jest.fn<typeof fetch>();
(globalThis as any).fetch = mockFetch;
import { piiScrubber } from './piiScrubber.js';
```

**Testing pattern for route integration tests:**
```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
const mockScrub = jest.spyOn(piiScrubber, 'scrub');
const mockReInject = jest.spyOn(piiScrubber, 'reInject');
// In beforeEach — set pass-through default so existing tests are unaffected:
mockScrub.mockImplementation(async (fields) => ({ scrubbedFields: { ...fields }, subMap: {} }));
mockReInject.mockImplementation((text) => text);
```

**Custom HIPAA recognizers:** `backend/presidio-config/custom-recognizers.yaml` — mounted into the analyzer container via Docker volume. Covers: MRN, DOB, health plan numbers, account numbers, ages > 89.

**Health check:** `GET /api/health` returns `{ presidio, analyzer, anonymizer }` status. Used by frontend health banner.
```

---

**Step 3: Commit and push**

```bash
git add CLAUDE.md
git commit -m "docs: document PII de-identification layer in CLAUDE.md"
git push
```

---

## Verification checklist

After all tasks, confirm:

- [ ] `docker-compose up presidio-analyzer presidio-anonymizer` starts both containers healthy
- [ ] `GET /api/health` returns `{ presidio: "healthy", analyzer: "ok", anonymizer: "ok" }`
- [ ] All backend tests pass: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage`
- [ ] With Presidio running: a chat request with `"Patient is John Smith, DOB 3/15/1965"` in the message body returns a response with "John Smith" visible but was never sent that way to the LLM (verify via backend logs or debug breakpoint)
- [ ] With Presidio stopped: any scribe or chat request returns 503 with the PII service unavailable message
