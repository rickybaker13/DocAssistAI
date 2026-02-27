# DocAssistAI — Claude Context

## Project Structure
- **Frontend:** React/TypeScript/Vite on `localhost:8080` — `npm run dev`
- **Backend:** Express/TypeScript on `localhost:3000` — `cd backend && npm run dev`
- **Scribe module:** `src/components/scribe-standalone/` (frontend) + `backend/src/routes/scribeAi.ts`
- **DB:** PostgreSQL via `pg` pool (`backend/src/database/db.ts`). Production: PostgreSQL container on DO droplet (`DATABASE_URL`). Tests: `pg-mem` in-memory (auto-selected when `NODE_ENV=test`). `getPool()` throws if `initPool()` not called first.

## Production Deployment

- **Frontend:** Vercel at `https://www.docassistai.app` — serves static React bundle only. No API proxy — Vercel never touches PHI.
- **Backend:** DigitalOcean droplet at `https://api.docassistai.app` — runs the entire backend stack via Docker Compose (`infra/docker-compose.prod.yml`).
- **`appConfig.ts` backendUrl:** Uses `'https://api.docassistai.app'` in production builds. Uses `VITE_BACKEND_URL || 'http://localhost:3000'` in local dev.
- **Droplet stack:** Caddy (TLS/reverse proxy) · Express API · PostgreSQL · Presidio (analyzer + anonymizer) · Whisper ASR. Only Caddy is exposed externally (ports 80/443). All other services communicate over Docker's internal network.
- **AI Provider:** AWS Bedrock (`EXTERNAL_AI_TYPE=bedrock`). Uses the AWS SDK credential chain. Model: `us.anthropic.claude-sonnet-4-6-20250514-v1:0`. Pluggable — can switch back to direct Anthropic API via `EXTERNAL_AI_TYPE=anthropic`.
- **Whisper:** Self-hosted on DigitalOcean droplet (`WHISPER_API_URL`). OpenAI fallback has been removed — `WHISPER_API_URL` is required.
- **Deploy check:** `GET https://api.docassistai.app/api/health` → `{ presidio, analyzer, anonymizer, whisper }` — if this returns JSON the backend is up.
- **Deploy flow:** `ssh root@droplet 'cd /opt/docassistai && git pull && docker compose -f docker-compose.prod.yml up -d --build'`

## Test Commands
```bash
# Backend (ESM mode required):
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage

# Frontend:
npx vitest run src/components/scribe-standalone/

# Full frontend suite:
npx vitest run src/
```

## Known Gotchas

**`trust proxy` required behind Caddy:** `app.set('trust proxy', 1)` must be the FIRST line after `const app = express()` in `backend/src/server.ts`, before any middleware. Caddy injects `X-Forwarded-For`; without this, `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR`.

**Cross-domain cookies (`SameSite`):** `COOKIE_OPTS.sameSite` in `backend/src/routes/scribeAuth.ts` is `'none'` in production and `'lax'` in dev. `SameSite=Lax` blocks cookies on cross-site `fetch` even with `credentials: 'include'`. `SameSite=None` requires `secure: true` (already set in production).

**`@ts-nocheck` on legacy FHIR files:** `backend/src/services/document/documentTools.ts`, `rag/embeddingService.ts`, `rag/patientDataIndexer.ts` carry `// @ts-nocheck`. They compile transitively via `src/routes/ai.ts` despite being listed in `tsconfig.json` excludes — the exclude only prevents direct compilation, not transitive imports.

**ESM `.js` extensions in compiled output:** Node.js v20 ESM requires explicit `.js` on all relative imports in compiled output. `tsx watch` (dev) resolves extensions automatically; compiled ESM does not. All scribe route files already fixed.

**ESM + Jest:** `jest` is not auto-injected in `--experimental-vm-modules` mode. Backend test files must include `import { jest } from '@jest/globals';` or spy/mock calls will throw `ReferenceError: jest is not defined`.

**SQLite schema migrations:** `CREATE TABLE IF NOT EXISTS` silently skips if the table exists — new columns are never added to existing DBs. Use the `COLUMN_MIGRATIONS` array in `backend/src/database/migrations.ts` + `pragma_table_info` check in `db.ts` for ALTER TABLE migrations.

**Tailwind z-index:** `z-60` is not in Tailwind v3's default scale. Use `z-[60]` arbitrary value syntax. Standard scale tops out at `z-50`.

## Key API Shapes (Scribe)

| Endpoint | Request | Response |
|---|---|---|
| `POST /api/ai/chat` | `{ messages: [{role,content}], patientContext? }` | `{ success, cited, data: { content } }` |
| `POST /api/ai/scribe/ghost-write` | `{ chatAnswer, destinationSection, existingContent, noteType, verbosity }` | `{ ghostWritten }` |
| `POST /api/ai/scribe/focused` | `{ sectionName, content, transcript }` | `{ analysis, citations, suggestions, confidence_breakdown }` |
| `POST /api/ai/scribe/resolve-suggestion` | `{ suggestion, sectionName, existingContent, transcript, noteType, verbosity }` | `{ ready: true, noteText }` OR `{ ready: false, question, options }` |

## Scribe Domain Concepts

- **Verbosity:** Author preference (brief / standard / detailed), persisted per note template. Default: `standard`. Controls AI output style in ghost-write and resolve-suggestion.
- **Note template:** Sets note_type + default sections + verbosity. Selecting a template auto-applies `setVerbosity(tmpl.verbosity)`.
- **SuggestionFlow state machine:** `loading → clarify? → resolving? → preview → null`. Managed in `FocusedAIPanel`. Each phase carries `suggestionIndex: number` to track which suggestion row is being processed.
- **COLUMN_MIGRATIONS pattern:** For adding columns to existing tables — checked via `pragma_table_info` before `ALTER TABLE`.

## FocusedAIPanel Architecture

- **Panel stays open:** Does NOT auto-close after applying a suggestion — user closes with × explicitly.
- **`startSuggestionProcessing(suggestion, index)`:** Core async fetch function, no concurrent-flow guard. Called by both single "Add →" and batch flows.
- **`handleAddToNote(suggestion, index)`:** Guard wrapper — checks `suggestionFlow !== null` before calling `startSuggestionProcessing`.
- **`addedSuggestionIndices: Set<number>`:** Tracks applied suggestion row indices → shows ✓ Added + dimmed row.
- **`addedCitationIndices: Set<number>`:** Tracks applied citation indices → shows ✓ Added on guideline cards.
- **`selectedSuggestions: Set<number>`:** Tracks checked checkboxes for batch selection.
- **`batchQueueRef: React.MutableRefObject<number[]>`:** Remaining batch indices (ref, not state — avoids stale closures in `handleConfirm`).
- **`batchTotal: number`:** Total items in current batch, used for "Processing N of M…" progress display.
- **Batch flow:** `handleBatchAdd` → dequeues first index → `startSuggestionProcessing` → on `handleConfirm` → pops next from `batchQueueRef` → auto-advances. Cancel clears queue.
- **Citation format:** `Per [guideline] ([year]) guidelines: [recommendation]` — formatted client-side, no AI call.
- **State resets:** All Set states (`addedSuggestionIndices`, `selectedSuggestions`, `addedCitationIndices`) reset in the section-change `useEffect`.


## CMS/ICD-10 Terminology Feature

- **`src/lib/cms-terms.ts`:** Client-side dictionary (~37 entries). `CmsTerm` shape: `vague`, `preferred[]`, `note`, `icd10?`, `excludeContext?` (regex — suppresses match if found within 40 chars). Pre-sorted by vague.length desc at module scope in hook.
- **`src/hooks/useCodingHighlights.ts`:** `useCodingHighlights(text)` → `Match[]` (memoized). `findCodingMatches(text)` is the pure function for unit testing. `COMPILED_TERMS` pre-compiles all regexes at module scope. **Must `mainRegex.lastIndex = 0` before each use** — global regexes are shared module-level objects.
- **`CodingTermPopover.tsx`:** `position: fixed` popover (inline style, not `z-60` Tailwind class). Closes on Escape, click-outside (`mousedown` listener on document), or skip.
- **`NoteSectionEditor.tsx`:** Overlay div (`data-testid="coding-highlight-overlay"`) behind a transparent textarea. Overlay text is `color: transparent`; flagged `<mark>` spans add `border-bottom: 2px solid #f59e0b`. Click detection via `onClick` → `selectionStart` → match lookup. Overlay and textarea share `sharedStyle` object for identical font/padding/lineHeight.
- **`ICD10_TERMINOLOGY_INSTRUCTION`:** Constant in `scribeAi.ts` appended to all 4 system prompts.
- **Gotcha — `excludeContext` suppression:** Regex matches within 40 chars (`EXCLUDE_CONTEXT_WINDOW`). Prevents false flags on "acute systolic CHF", "COPD without exacerbation", etc.
- **Gotcha — longer phrases win:** `COMPILED_TERMS` sorted by `vague.length` desc so "history of stroke" is checked before "stroke", preventing substring overlap.
- **Overlay layout:** Overlay and textarea MUST share identical `fontFamily`, `fontSize`, `lineHeight`, `padding` via the `sharedStyle` object — any mismatch misaligns underlines.

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

## Known Gotchas

- **`ANTHROPIC_API_KEY=` (empty) blocks dotenv:** Claude Code bash has `ANTHROPIC_API_KEY=` (empty string), preventing dotenv from loading the real key. Start backend with `env -u ANTHROPIC_API_KEY npm run dev`.
- **`resolve-suggestion` options validation:** Any non-empty options array is accepted (`options.length < 1` rejects). AI sometimes returns 2 or 4 options — that's fine.
