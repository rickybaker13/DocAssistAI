# Focused AI — Smart Suggestion Resolution

**Date:** 2026-02-23
**Status:** Approved

## Problem

When a user clicks "Add to note" on a Focused AI suggestion, the suggestion text is appended verbatim to the note section. Suggestions are *guidance* ("Document stroke type (ischemic vs. hemorrhagic)..."), not *note content*. The result is meta-commentary in the clinical record, not a clinical note line.

## Goal

"Add to note" should insert clean, note-ready content in the author's chosen verbosity style — and if the AI lacks a critical clinical detail, ask for it first via a quick-select overlay before generating the text.

## Approved Design: Two-call resolution flow (Approach A)

### Data flow

```
User clicks "Add to note" on suggestion
  └─> POST /api/ai/scribe/resolve-suggestion
        ├─> { ready: true,  noteText }        → show Preview overlay → Confirm → insert
        └─> { ready: false, question, options } → show Clarify overlay
              └─> User taps option
                    └─> POST /api/ai/scribe/ghost-write (suggestion + answer)
                          └─> show Preview overlay → Confirm → insert
```

### Backend — `POST /api/ai/scribe/resolve-suggestion`

**Request body:**
```ts
{
  suggestion: string;       // e.g. "Document stroke type (ischemic vs hemorrhagic)..."
  sectionName: string;
  existingContent: string;
  transcript: string;
  noteType: string;
  verbosity: 'brief' | 'standard' | 'detailed';
}
```

**Response — ready:**
```ts
{ ready: true; noteText: string }
```

**Response — needs clarification:**
```ts
{ ready: false; question: string; options: string[] }  // 2–4 options
```

**AI prompt strategy:**
- Instruct the AI to first search the transcript and existing section content for the missing detail
- Only return `ready: false` when a clinically critical piece of information is genuinely absent and cannot be inferred
- When `ready: true`, apply verbosity-specific writing rules (same as ghost-write)
- Never include meta-commentary, caveats, or guidance text in `noteText`
- `options` must include a "Not yet determined / unknown" escape option so the user is never stuck

### Frontend — `FocusedAIPanel` changes

**New props:**
```ts
noteType: string;
verbosity: string;
```

**New state:** `suggestionFlow`
```ts
type SuggestionFlow =
  | { phase: 'loading'; suggestion: string; sectionId: string }
  | { phase: 'clarify'; suggestion: string; sectionId: string; question: string; options: string[] }
  | { phase: 'preview'; sectionId: string; noteText: string }
  | null;
```

**Overlay behavior:**
- Appears at `z-60` (above the FocusedAIPanel at `z-50`)
- Small centered card (`max-w-sm`), dimmed backdrop (`bg-black/40`)
- Dismissible with Cancel / × at all phases
- Loading: spinner + "Preparing note text..."
- Clarify: question text + pill buttons for each option, Cancel
- Preview: note text in a green-tinted box, `[Confirm ✓]` and `[Cancel]` buttons

**On Confirm:** calls `onApplySuggestion(sectionId, noteText)` — existing callback, unchanged signature — then clears `suggestionFlow` and closes FocusedAIPanel.

### `ScribeNotePage` — minimal change

Add `noteType` and `verbosity` props to `<FocusedAIPanel>` render call. No logic changes.

## Files touched

| File | Change |
|------|--------|
| `backend/src/routes/scribeAi.ts` | Add `POST /api/ai/scribe/resolve-suggestion` handler |
| `backend/src/routes/scribeAi.test.ts` | Tests for resolve-suggestion (ready + clarify paths) |
| `src/components/scribe-standalone/FocusedAIPanel.tsx` | New props, suggestionFlow state, overlay UI |
| `src/components/scribe-standalone/FocusedAIPanel.test.tsx` | Tests for overlay phases |
| `src/components/scribe-standalone/ScribeNotePage.tsx` | Pass noteType + verbosity to FocusedAIPanel |

## Out of scope

- Multi-step clarification (only one question per suggestion)
- Saving resolved suggestions for reuse
- Changes to the Focused AI analysis or citations display
