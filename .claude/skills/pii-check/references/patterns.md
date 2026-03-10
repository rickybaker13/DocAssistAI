# PII Scrubbing Patterns — Code Reference

Exact code patterns extracted from the DocAssistAI codebase. Use these templates when adding PII scrubbing to a new route or verifying existing routes.

---

## 1. Route-Level PII Pattern (Complete)

This is the full pattern used in every PII-protected route handler. Extracted from `scribeAi.ts`.

### Import (top of file)

```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';
```

Also import the TOKEN_PRESERVATION constant (defined in `scribeAi.ts`):

```typescript
const TOKEN_PRESERVATION_INSTRUCTION = `\nText may contain privacy-protection tokens in [TOKEN_N] format (e.g., [PERSON_0], [DATE_0], [MRN_0]). Preserve these tokens exactly as written — do not rephrase, remove, or modify any [BRACKET_N] token.`;
```

### Scrub Before LLM Call

Pattern from `/generate` (single field):
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

Pattern from `/resolve-suggestion` (multiple fields):
```typescript
let scrubbedSuggestion = suggestion;
let scrubbedExistingContent = existingContent;
let scrubbedTranscript = transcript;
let subMap: Record<string, string> = {};
try {
  const result = await piiScrubber.scrub({
    suggestion,
    existingContent,
    transcript,
  });
  scrubbedSuggestion = result.scrubbedFields.suggestion;
  scrubbedExistingContent = result.scrubbedFields.existingContent;
  scrubbedTranscript = result.scrubbedFields.transcript;
  subMap = result.subMap;
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ error: (err as Error).message }) as any;
  }
  throw err;
}
```

**Critical:** Use ONE `piiScrubber.scrub()` call with ALL fields. NOT separate calls per field. The shared `subMap` ensures "John Smith" gets the same `[PERSON_0]` token across all fields.

### System Prompt — Append Token Preservation

```typescript
const systemPrompt = `Your system prompt here.
${ICD10_TERMINOLOGY_INSTRUCTION}${TOKEN_PRESERVATION_INSTRUCTION}`;
```

### Use Scrubbed Values in the LLM Prompt

```typescript
// CORRECT — uses scrubbed variable
const userPrompt = `Transcript:\n"${scrubbedTranscript}"`;

// WRONG — leaks PHI to LLM
const userPrompt = `Transcript:\n"${transcript}"`;
```

### Re-inject on LLM Response

Pattern for a single text field (from `/ghost-write`):
```typescript
const ghostWritten = piiScrubber.reInject(extractContent(raw).trim(), subMap);
return res.json({ ghostWritten });
```

Pattern for structured JSON response with multiple text fields (from `/focused`):
```typescript
if (Object.keys(subMap).length > 0) {
  parsed.analysis = piiScrubber.reInject(parsed.analysis ?? '', subMap);
  parsed.suggestions = (parsed.suggestions ?? []).map(
    (s: string) => piiScrubber.reInject(s, subMap)
  );
  parsed.citations = (parsed.citations ?? []).map((c: any) => ({
    ...c,
    recommendation: piiScrubber.reInject(c.recommendation ?? '', subMap),
  }));
  parsed.confidence_breakdown = piiScrubber.reInject(
    parsed.confidence_breakdown ?? '', subMap
  );
}
```

Pattern for JSON with nested arrays (from `/billing-codes`):
```typescript
if (Object.keys(subMapBilling).length > 0) {
  for (const code of parsed.icd10_codes ?? []) {
    code.supporting_text = piiScrubber.reInject(code.supporting_text ?? '', subMapBilling);
  }
  for (const code of parsed.cpt_codes ?? []) {
    code.reasoning = piiScrubber.reInject(code.reasoning ?? '', subMapBilling);
  }
  if (parsed.em_level) {
    parsed.em_level.reasoning = piiScrubber.reInject(parsed.em_level.reasoning ?? '', subMapBilling);
  }
  parsed.missing_documentation = (parsed.missing_documentation ?? []).map(
    (item: string) => piiScrubber.reInject(item, subMapBilling)
  );
}
```

**Rule:** Re-inject EVERY text field the LLM could have written tokens into. If in doubt, re-inject it — `reInject` with no matching tokens is a no-op.

---

## 2. Test Pattern — PII Tests

### Test File Setup (add to existing test file)

Add these variables alongside existing mock declarations:

```typescript
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';

let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;
```

In `beforeAll`:
```typescript
mockScrub = jest.spyOn(piiScrubber, 'scrub');
mockReInject = jest.spyOn(piiScrubber, 'reInject');
```

In `beforeEach` — **pass-through default** (critical for existing tests to keep working):
```typescript
mockScrub.mockImplementation(async (fields) => ({
  scrubbedFields: { ...fields },
  subMap: {},
}));
mockReInject.mockImplementation((text) => text);
```

In `afterEach`:
```typescript
mockScrub.mockReset();
mockReInject.mockReset();
```

### Test: Scrub Is Called With Correct Fields

```typescript
it('calls piiScrubber.scrub with {fieldName} before LLM call', async () => {
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
  // Verify scrub was called with the original value
  expect(mockScrub).toHaveBeenCalledWith(
    expect.objectContaining({ transcript: 'Patient is John Smith.' })
  );
  // Verify LLM received scrubbed value (token, not real name)
  const userMsg: string =
    (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'user')?.content ?? '';
  expect(userMsg).toContain('[PERSON_0]');
  expect(userMsg).not.toContain('John Smith');
  // Verify client received re-injected value (real name restored)
  expect(res.body.sections[0].content).toContain('John Smith');
});
```

### Test: 503 When Presidio Is Down, LLM Never Called

```typescript
it('returns 503 when Presidio is unavailable, never calls LLM', async () => {
  mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

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
```

### Test: System Prompt Includes Token Preservation

```typescript
it('system prompt includes token-preservation instruction', async () => {
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
```

---

## 3. Chat Route Pattern (ai.ts — Multiple Messages)

The `/api/ai/chat` endpoint scrubs user messages differently — it keys them as `message_0`, `message_1`, etc.:

```typescript
// Build scrub-fields from user messages only (system/assistant messages are not user-supplied PHI)
const userMessages = messages.filter((m: any) => m.role === 'user');
const scrubFields: Record<string, string> = {};
userMessages.forEach((m: any, i: number) => {
  scrubFields[`message_${i}`] = m.content;
});

let chatSubMap: Record<string, string> = {};
try {
  const scrubResult = await piiScrubber.scrub(scrubFields);
  chatSubMap = scrubResult.subMap;
  // Replace original message content with scrubbed versions
  let userIdx = 0;
  for (const msg of messages) {
    if (msg.role === 'user') {
      msg.content = scrubResult.scrubbedFields[`message_${userIdx}`];
      userIdx++;
    }
  }
} catch (err) {
  if (err instanceof PiiServiceUnavailableError) {
    return res.status(503).json({ success: false, error: (err as Error).message }) as any;
  }
  throw err;
}
```

Re-injection on response:
```typescript
if (Object.keys(chatSubMap).length > 0) {
  response.content = piiScrubber.reInject(response.content, chatSubMap);
}
```

---

## 4. piiScrubber API Reference

```typescript
// ── scrub ──────────────────────────────────────────────────────
// Input:  Record<string, string> — named text fields
// Output: { scrubbedFields: Record<string, string>, subMap: SubstitutionMap }
// Throws: PiiServiceUnavailableError if Presidio is down
const { scrubbedFields, subMap } = await piiScrubber.scrub({
  transcript: 'John Smith has chest pain.',
  existingContent: 'Dr. John Smith assessed the patient.',
});
// scrubbedFields.transcript = '[PERSON_0] has chest pain.'
// scrubbedFields.existingContent = 'Dr. [PERSON_0] assessed the patient.'
// subMap = { '[PERSON_0]': 'John Smith' }

// ── reInject ───────────────────────────────────────────────────
// Input:  text (string), subMap (SubstitutionMap)
// Output: string with tokens replaced by original values
// Sync — no I/O, safe to call multiple times
const restored = piiScrubber.reInject('[PERSON_0] has chest pain.', subMap);
// restored = 'John Smith has chest pain.'
```

**SubstitutionMap shape:** `Record<string, string>` where key = token (`[ENTITY_TYPE_N]`), value = original text.

**Token format:** `[ENTITY_TYPE_N]` — e.g., `[PERSON_0]`, `[DATE_TIME_0]`, `[MEDICAL_RECORD_NUMBER_0]`, `[PHONE_NUMBER_0]`.

**Empty fields:** Passing `''` (empty string) returns it unchanged without calling Presidio.

**Shared tokens:** Same original value → same token across all fields in one `scrub()` call.

---

## 5. Checklist for Adding PII to a New Route

Use this when the `/scribe-route` skill generates a new AI-touching route:

- [ ] Import `piiScrubber` and `PiiServiceUnavailableError` with `.js` extension
- [ ] Define `TOKEN_PRESERVATION_INSTRUCTION` (or import it if shared)
- [ ] Identify ALL `req.body` text fields that end up in the LLM prompt
- [ ] Call `piiScrubber.scrub({ ...allTextFields })` — one call, all fields
- [ ] Destructure `scrubbedFields` and `subMap` from result
- [ ] Catch `PiiServiceUnavailableError` → return 503 immediately
- [ ] Use `scrubbedFields.xxx` (not `req.body.xxx`) when building LLM messages
- [ ] Append `TOKEN_PRESERVATION_INSTRUCTION` to the system prompt
- [ ] After parsing LLM response, call `piiScrubber.reInject(text, subMap)` on EVERY text field
- [ ] Guard with `if (Object.keys(subMap).length > 0)` for efficiency (optional — reInject with empty map is a no-op)
- [ ] Add 3 PII tests: scrub called, 503 on failure, re-inject works
- [ ] Add pass-through mock defaults in `beforeEach` so existing tests still pass
