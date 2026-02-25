# PII De-Identification Design — DocAssistAI Scribe

**Date:** 2026-02-24
**Status:** Approved
**Scope:** All text sent to the LLM across all 5 endpoints

---

## Problem

Every LLM call in the Scribe feature sends raw clinical text — transcripts, note content, chat messages — directly to the Claude API. This text routinely contains HIPAA-protected health information (PHI): patient names, dates of birth, medical record numbers, social security numbers, addresses, and more. Sending PHI to an external LLM is a HIPAA compliance risk.

---

## Solution

Intercept all text fields before every LLM call, de-identify them using Microsoft Presidio, and automatically re-inject the real values into the LLM's response before returning it to the frontend. The physician sees their note with real names; the LLM never sees any PII.

---

## Architecture

### Deployment Model

Docker Compose sidecar. Two official Microsoft container images run alongside the Express backend:

```
┌──────────────────────────────────────────────────┐
│  docker-compose up                               │
│                                                  │
│  Express :3000 ──HTTP──▶ presidio-analyzer :5002 │
│                ──HTTP──▶ presidio-anonymizer:5001 │
│                                                  │
│  Mobile/desktop browser ──▶ React frontend :8080  │
└──────────────────────────────────────────────────┘
```

No Python in the codebase. Presidio is a black box called over REST.

### Deployment Targets

| Mode | Description |
|---|---|
| **Local** | `docker-compose up` on developer's laptop. Mobile devices connect via LAN or are used only as capture devices. |
| **Cloud** | Backend + Presidio containers deployed to a cloud VM or container platform. Mobile devices access full Scribe functionality via browser. |

The codebase is identical in both modes. `PRESIDIO_ANALYZER_URL` env var switches between `http://localhost:5002` and `http://presidio-analyzer:3000`.

### Data Flow

```
Raw text (transcript, note, chat)
    │
    ▼
piiScrubber.scrub(text)
    │
    ├── POST /analyze → presidio-analyzer
    │   returns: [{ entity_type, start, end, score }, ...]
    │
    ├── Build subMap (unique token per unique entity value):
    │   { "[PERSON_0]": "John Smith", "[DATE_0]": "3/15/1965", "[MRN_0]": "89234" }
    │
    └── Replace spans in reverse order → scrubbedText
            │
            ▼
    aiService.chat() ← zero PII in input
            │
            ▼
    LLM response (contains [PERSON_0], [DATE_0] etc.)
            │
            ▼
    piiScrubber.reInject(response, subMap)
            │
            ▼
    Physician sees note with real values restored
```

### Fail Behavior

**Fail closed everywhere.** If Presidio is unreachable or times out, the request returns HTTP 503 and the LLM is never called. No PII is ever transmitted to the LLM under any failure condition.

Error message returned to client:
```json
{ "error": "PII scrubbing service unavailable. Patient data cannot be sent to AI until de-identification is restored." }
```

---

## Core Service: `piiScrubber.ts`

### API

```typescript
scrub(fields: Record<string, string>): Promise<ScrubResult>
reInject(text: string, subMap: SubstitutionMap): string
```

`scrub()` accepts a named map of fields (so one subMap spans multiple fields in a single request), calls Presidio analyzer, builds the substitution map, and returns both the scrubbed fields and the map.

`reInject()` is a pure synchronous function — replaces all `[TOKEN_N]` occurrences with original values.

### Token Format

Each unique entity value gets a unique numbered token:

```
"[PERSON_0]"              → first distinct person value
"[PERSON_1]"              → second distinct person value
"[DATE_0]"                → first distinct date value
"[MEDICAL_RECORD_NUMBER_0]" → first MRN
"[REDACTED_0]"            → any entity type below confidence threshold
```

Same value appearing multiple times → same token. Different values of same type → different numbered tokens.

### Confidence Threshold

Only redact entities where Presidio score ≥ `PRESIDIO_MIN_SCORE` (default: `0.7`). Low-confidence detections are left in place — corrupting clinical content is worse than missing an uncertain PII hit.

### Why Analyzer-Only (Not Anonymizer)

We call only the Presidio **Analyzer** service, not the Anonymizer. The Anonymizer replaces by entity *type* (all PERSONs get the same token), losing the ability to distinguish "John Smith" from "Dr. Adams". By doing our own replacement in TypeScript, we assign unique tokens per unique value, enabling accurate re-injection.

---

## Integration Points

One shared `subMap` per request. All text fields going into a single LLM call are scrubbed together.

| Endpoint | Fields scrubbed | Fields re-injected |
|---|---|---|
| `POST /api/ai/chat` | `messages[].content`, `patientContext` | `data.content` |
| `POST /api/ai/scribe/generate` | `transcript`, `sections[].content` | `sections[].content` |
| `POST /api/ai/scribe/ghost-write` | `chatAnswer`, `existingContent` | `ghostWritten` |
| `POST /api/ai/scribe/focused` | `content`, `transcript` | `analysis`, `suggestions[].text` |
| `POST /api/ai/scribe/resolve-suggestion` | `suggestion`, `existingContent`, `transcript` | `noteText`, `question` |

No middleware — scrubber is called explicitly inside each route handler for visibility and auditability.

---

## HIPAA 18-Identifier Coverage

### Natively covered by Presidio

| HIPAA Identifier | Presidio Entity |
|---|---|
| Names | `PERSON` |
| Phone / Fax numbers | `PHONE_NUMBER` |
| Email addresses | `EMAIL_ADDRESS` |
| Social security numbers | `US_SSN` |
| Geographic data (city, zip, address) | `LOCATION` |
| URLs | `URL` |
| IP addresses | `IP_ADDRESS` |
| Driver's license numbers | `US_DRIVER_LICENSE` |
| Medical license numbers | `MEDICAL_LICENSE` |

### Custom YAML recognizers (mounted into analyzer container)

| HIPAA Identifier | Custom Entity | Pattern Approach |
|---|---|---|
| Medical record numbers | `MEDICAL_RECORD_NUMBER` | Regex: `MRN[\s#:]*[A-Z0-9]{4,12}` + context words |
| Dates except year (DOB) | `DATE_OF_BIRTH` | Regex: `DOB[\s:]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}` |
| Health plan / insurance IDs | `HEALTH_PLAN_NUMBER` | Regex: `[A-Z]{2,3}[\s-]?\d{6,12}` |
| Account numbers | `ACCOUNT_NUMBER` | Context-aware: "account", "acct #" |
| Ages over 89 | `AGE_OVER_89` | Regex: `\b(9[0-9]\|1[0-9]{2})\s*(?:year\|yr)` |

Config file: `backend/presidio-config/custom-recognizers.yaml` — mounted via Docker volume, no Python required.

### Acknowledged gap

Free-form narrative re-identification risk ("my patient from Springfield who works at the downtown clinic") requires clinical NER models beyond Presidio's base capability. Addressed in V2 via transformer-based clinical recognizer (e.g., ClinicalBERT). Out of scope for this implementation.

---

## System Prompt Addition

Added to all 5 system prompts:

```
Text may contain privacy-protection tokens in [TOKEN_N] format (e.g., [PERSON_0], [DATE_0], [MRN_0]). Preserve these tokens exactly as written — do not rephrase, remove, or modify any [BRACKET_N] token.
```

---

## Infrastructure

### docker-compose.yml (project root)

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

### New environment variables

```bash
PRESIDIO_ANALYZER_URL=http://localhost:5002
PRESIDIO_ANONYMIZER_URL=http://localhost:5001
PRESIDIO_MIN_SCORE=0.7
PRESIDIO_TIMEOUT_MS=5000
```

### Health endpoint

`GET /api/health` — returns Presidio service status for frontend health banner:

```json
{ "presidio": "healthy", "analyzer": "ok", "anonymizer": "ok" }
```

---

## Files Changed

| File | Change |
|---|---|
| `docker-compose.yml` | **NEW** — full stack definition |
| `backend/presidio-config/custom-recognizers.yaml` | **NEW** — HIPAA gap recognizers |
| `backend/src/services/piiScrubber.ts` | **NEW** — scrub() + reInject() |
| `backend/src/services/piiScrubber.test.ts` | **NEW** — ~12 unit tests |
| `backend/src/routes/scribeAi.ts` | **MODIFY** — scrub/reInject at all 5 LLM calls |
| `backend/src/routes/chat.ts` | **MODIFY** — scrub/reInject on chat endpoint |
| `backend/src/routes/health.ts` | **NEW** — Presidio health check endpoint |
| `backend/src/routes/scribeAi.test.ts` | **MODIFY** — ~8 integration tests |
| `CLAUDE.md` | **MODIFY** — document PII layer |

---

## Testing

### Unit tests — `piiScrubber.test.ts` (~12 tests)

- Scrubs PERSON entity and builds correct subMap
- Assigns unique tokens to different values of same entity type
- Same value appearing twice gets same token
- Reverse-order replacement preserves correct character spans
- reInject restores all tokens to original values
- Throws `PiiServiceUnavailableError` when Presidio unreachable
- Skips entities below `PRESIDIO_MIN_SCORE` threshold
- Scrubs multiple fields and shares one subMap across them
- Handles empty string input gracefully
- Handles text with no PII detected

### Integration tests — `scribeAi.test.ts` additions (~8 tests)

- Scrubs transcript before LLM call on `/generate`
- Scrubs chatAnswer and existingContent on `/ghost-write`
- Scrubs content and transcript on `/focused`
- Scrubs suggestion, existingContent, transcript on `/resolve-suggestion`
- Returns 503 when Presidio unavailable, never calls aiService
- Re-injects real values into LLM response before returning to client
- System prompt contains token-preservation instruction

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Analyzer only (not anonymizer) | ✅ | Unique tokens per value enable accurate re-injection |
| Fail behavior | Fail closed always | HIPAA compliance — no PII transmitted under any failure |
| Substitution map scope | Request-scoped, memory only | Never persisted, never logged |
| Confidence threshold | 0.7 (configurable) | Prefer missing uncertain PII over corrupting clinical content |
| Middleware vs. explicit | Explicit per-route | Visible, auditable, no hidden behavior |
| Deployment | Docker Compose sidecar | Cloud-ready, no Python in codebase, enterprise pattern |
