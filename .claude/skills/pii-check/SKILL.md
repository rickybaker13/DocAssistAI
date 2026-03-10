---
name: pii-check
description: >-
  Use when the user asks to "check PII", "verify PII scrubbing", "audit PII",
  "check de-identification", "is PII handled", "HIPAA check", or when adding
  a new route/endpoint that calls an LLM. Also use proactively after
  scaffolding a new AI-touching route with /scribe-route.
version: 0.1.0
---

# PII De-Identification Audit

Verify that every backend route making LLM calls properly scrubs PII before sending data to the AI and re-injects original values into the response.

## Why This Exists

DocAssistAI handles PHI (Protected Health Information). Every text field sent to any LLM must pass through `piiScrubber.scrub()` first, and every text field in the LLM response must pass through `piiScrubber.reInject()` before returning to the client. If Presidio is down, the endpoint must return **503 immediately** — the LLM is never called. This is fail-closed by design.

Missing PII scrubbing on even one field is a HIPAA compliance gap.

## Audit Workflow

### Step 1: Find All LLM-Calling Routes

Search for all files that call `aiService.chat`, `provider.chat`, or make direct fetch calls to AI APIs:

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
grep -rn "aiService\.chat\|provider\.chat\|api\.anthropic\.com\|api\.groq\.com\|openrouter\.ai" src/routes/ src/services/ --include="*.ts" | grep -v "\.test\." | grep -v "node_modules"
```

### Step 2: For Each Route, Verify the 7-Point PII Checklist

For every endpoint handler that calls an LLM, check ALL of the following:

| # | Check | What to Look For |
|---|-------|-----------------|
| 1 | **Import** | `import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js'` at top of file |
| 2 | **Scrub ALL text fields** | Every user-supplied text field in `req.body` that gets included in the LLM prompt must be in the `piiScrubber.scrub({ field1, field2 })` call. Missing a field = PHI leak. |
| 3 | **503 on Presidio failure** | `catch (err) { if (err instanceof PiiServiceUnavailableError) { return res.status(503).json(...) } }` — must be BEFORE the `aiService.chat()` call |
| 4 | **Scrubbed values used in prompt** | The LLM prompt must use `scrubbedFields.xxx` variables, NOT the original `req.body` values |
| 5 | **TOKEN_PRESERVATION_INSTRUCTION** | System prompt must append `TOKEN_PRESERVATION_INSTRUCTION` so the LLM preserves `[TOKEN_N]` brackets |
| 6 | **reInject on ALL response text** | Every text field in the parsed LLM response must pass through `piiScrubber.reInject(text, subMap)` before being sent to the client |
| 7 | **Test coverage** | The route's test file must have PII-specific tests (scrub called, 503 on failure, re-inject works) |

### Step 3: Check for Indirect LLM Calls via Services

Some routes don't call `aiService.chat()` directly — they call service classes that internally call `provider.chat()`. These are **harder to audit** because the PII scrubbing must happen in the route handler BEFORE passing data to the service.

Search for service files that call `provider.chat()`:
```bash
grep -rn "provider\.chat\|this\.provider\.chat" src/services/ --include="*.ts" | grep -v "\.test\." | grep -v "node_modules"
```

Then find which routes call those services:
```bash
# For each service class found, search for its usage in routes
grep -rn "smartEditor\|noteAnalyzer\|templateLearner\|documentGenerator\|documentCritic" src/routes/ --include="*.ts" | grep -v "\.test\."
```

### Step 4: Report Findings

Output a table like this:

```
── PII Audit Results ───────────────────────────────────────
  PRODUCTION SCRIBE ROUTES
  POST /api/ai/scribe/generate       ✅ Protected (7/7)
  POST /api/ai/scribe/focused        ✅ Protected (7/7)
  POST /api/ai/scribe/ghost-write    ✅ Protected (7/7)
  POST /api/ai/scribe/resolve        ✅ Protected (7/7)
  POST /api/ai/scribe/billing-codes  ✅ Protected (7/7)
  POST /api/ai/chat                  ✅ Protected (7/7)

  EMR-LAUNCH ROUTES (dormant — not in production)
  POST /api/ai/generate-document     ⚠️  No scrubbing (dormant)
  POST /api/ai/edit-document         ⚠️  No scrubbing (dormant)
  POST /api/ai/learn-templates       ⚠️  No scrubbing (dormant)
  POST /api/discovery/analyze-notes  ⚠️  No scrubbing (dormant)
─────────────────────────────────────────────────────────────
  Result: ALL PRODUCTION ROUTES PROTECTED ✅
          4 dormant EMR-launch routes need PII before going live
```

For any NEW unprotected production route, show:
- Which checks failed (1-7)
- Which text fields are exposed to the LLM unscrubbed
- Severity (HIGH = patient data/clinical notes, MEDIUM = structural analysis, LOW = metadata only)

### Step 5: Fix Unprotected Routes

For each unprotected route, add PII scrubbing following the exact pattern in `references/patterns.md`. The pattern is:

1. Add imports at top of file
2. Build a fields object from all user-supplied text in `req.body`
3. Wrap `piiScrubber.scrub(fields)` in try/catch BEFORE any LLM call
4. Use `scrubbedFields` in the prompt — never `req.body` values
5. Add `TOKEN_PRESERVATION_INSTRUCTION` to the system prompt
6. Call `reInject()` on every text field in the LLM response
7. Add PII tests to the test file

## Known Protected Routes — Production Scribe (as of last audit)

These are the **live production endpoints** powering the Scribe product. All have full PII coverage:

| Route | File | Fields Scrubbed |
|-------|------|----------------|
| `POST /api/ai/scribe/generate` | `scribeAi.ts` | `transcript` |
| `POST /api/ai/scribe/focused` | `scribeAi.ts` | `content`, `transcript` |
| `POST /api/ai/scribe/ghost-write` | `scribeAi.ts` | `chatAnswer`, `existingContent` |
| `POST /api/ai/scribe/resolve-suggestion` | `scribeAi.ts` | `suggestion`, `existingContent`, `transcript` |
| `POST /api/ai/scribe/billing-codes` | `scribeAi.ts` | `note` (combined sections), `transcript` |
| `POST /api/ai/chat` | `ai.ts` | User-role messages (keyed as `message_0`, `message_1`, etc.) |

## EMR-Launch Endpoints — Not in Production (need PII before going live)

These routes are from the **EMR-launch version** of DocAssistAI (co-writer, Signal Engine, discovery/onboarding). They are NOT reachable from the current production Scribe product. They make LLM calls without PII scrubbing and **must have scrubbing added before they are ever enabled in production**.

Do NOT flag these as urgent failures during audits — they are dormant. Flag them only if the EMR-launch product is being built out.

| Route | File | Service | What's Unscrubbed |
|-------|------|---------|-------------------|
| `POST /api/ai/generate-document` | `ai.ts` | `aiService.chat()` direct | Patient timeline data (names, DOBs, MRNs, diagnoses from FHIR) + freeform `additionalContext` |
| `POST /api/ai/edit-document` | `ai.ts` | `smartEditor.ts` → `provider.chat()` (5 calls) | Full clinical note text + `patientSummary` + user edit `command` |
| `POST /api/ai/learn-templates` | `ai.ts` | `templateLearner.ts` → `provider.chat()` | Array of full clinical notes (sent for structural analysis but PHI included) |
| `POST /api/discovery/analyze-notes` | `discovery.ts` | `noteAnalyzer.ts` → `provider.chat()` (2 calls) | Note content + provider information |

## Critical Rules

1. **Fail closed, always.** If `piiScrubber.scrub()` throws `PiiServiceUnavailableError`, return 503. Never fall back to sending unscrubbed text.
2. **Scrub ALL text fields.** If a field from `req.body` ends up in the LLM prompt (even as context), it must be scrubbed. This includes `existingContent`, `transcript`, `patientContext`, `patientSummary` — not just the "main" field.
3. **reInject ALL response text.** Every text field the LLM returns must be re-injected. Missing one means the client sees `[PERSON_0]` instead of the real name.
4. **Shared subMap across fields.** One `piiScrubber.scrub({ field1, field2, field3 })` call — not separate calls per field. The shared subMap ensures "John Smith" gets the same token `[PERSON_0]` regardless of which field it appears in.
5. **TOKEN_PRESERVATION_INSTRUCTION in system prompt.** Without this, the LLM may rephrase or drop `[PERSON_0]` tokens, breaking re-injection.
6. **Test both paths.** Every PII-protected route needs: (a) a test showing scrub is called with the right fields, (b) a test showing 503 when Presidio is down and LLM is never called, (c) a test showing re-injection restores original values.
