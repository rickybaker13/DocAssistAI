# DocAssistAI — Claude Context

## Project Structure
- **Frontend:** React/TypeScript/Vite on `localhost:8080` — `npm run dev`
- **Backend:** Express/TypeScript on `localhost:3000` — `cd backend && npm run dev`
- **Scribe module:** `src/components/scribe-standalone/` (frontend) + `backend/src/routes/scribeAi.ts`
- **DB:** SQLite via better-sqlite3 at `backend/data/scribe.db`

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

## Known Gotchas

- **`ANTHROPIC_API_KEY=` (empty) blocks dotenv:** Claude Code bash has `ANTHROPIC_API_KEY=` (empty string), preventing dotenv from loading the real key. Start backend with `env -u ANTHROPIC_API_KEY npm run dev`.
- **`resolve-suggestion` options validation:** Any non-empty options array is accepted (`options.length < 1` rejects). AI sometimes returns 2 or 4 options — that's fine.
