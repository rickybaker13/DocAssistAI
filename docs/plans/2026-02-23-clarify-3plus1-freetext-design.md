# Clarify Overlay: Contextual 3+1 Free-Text Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

The current clarify overlay presents 2–4 generic preset options (e.g. "Ischemic / Hemorrhagic / Not yet determined") when the AI needs more information. These are guesses rather than clinically meaningful prompts. For complex clinical details — stroke territory, heart failure subtype, EF value, artery involved — the author needs to either pick a common answer quickly or type the exact clinical detail.

## Goal

Replace fixed-option clarify UX with a contextual 3+1 model: 3 AI-generated case-specific common answers (fast tap) + a 4th "Other..." pill that reveals a free-text input (for anything not covered).

## Interaction Flow

1. AI determines it needs a clarifying detail → returns `ready: false`
2. Overlay shows focused question ("What artery was involved?")
3. Three pill buttons show the 3 most clinically common/relevant answers for this specific case (e.g. "Left MCA", "Right MCA", "Basilar artery")
4. A 4th pill "Other…" is always appended by the frontend
5. Tapping one of the 3 common answers → immediately proceeds to ghost-write → preview (fast path)
6. Tapping "Other…" → pills replaced with a text input + Submit button + "← back" link
7. Author types their answer (e.g. "right posterior cerebral artery") and submits
8. Same `handleOptionSelected(text)` path → ghost-write → preview → confirm

## Changes

### Backend: `backend/src/routes/scribeAi.ts` — `resolve-suggestion` handler

Update the system prompt to:
- Generate exactly **3** case-specific common answers to the question (not generic or vague)
- Draw from what's clinically probable given the note type, transcript, and existing section content
- Remove the generic "Not yet determined" escape — that's handled by the "Other…" UI
- Keep the same response shape: `{ ready: false, question: string, options: string[] }` where `options` is always exactly 3 items

Example system prompt guidance:
> "If ready=false, provide exactly 3 options that are the most clinically common and specific answers to your question given the case context. Do not include vague escapes like 'Not yet determined' — the UI provides a free-text fallback. Options should be real clinical values, not placeholders."

### Frontend: `src/components/scribe-standalone/FocusedAIPanel.tsx`

The `clarify` phase render block gets a local `showFreeText` boolean toggle (no changes to the `SuggestionFlow` union type or any handler):

**Default state (showFreeText = false):**
- Render AI's 3 option pills (text-gray-800 as already fixed)
- Render a 4th "Other…" pill with dashed border style to distinguish it
- Cancel button unchanged

**When "Other…" is tapped (showFreeText = true):**
- Pills are hidden
- Text input appears with clinical placeholder (derived from question context — "e.g. right MCA, basilar artery…")
- Submit button calls `handleOptionSelected(inputValue)`
- Enter key also submits
- "← back" link returns to the pill view (sets showFreeText = false)
- Cancel button unchanged

### Backend tests: `backend/src/routes/scribeAi.test.ts`
- Update the `ready=false` test assertion: `options.length` should equal exactly 3 (currently asserts `>= 2`)
- Add a test verifying no option equals "Not yet determined" or equivalent escape text

### Frontend tests: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`
- Add test: "Other… pill appears in clarify phase"
- Add test: "clicking Other… reveals text input"
- Add test: "submitting free-text input calls handleOptionSelected with typed value"
- Add test: "back link returns to pill view"
- Update existing clarify test: mock returns 3 options (not 4), assert "Other…" pill always present

## Files Changed
- `backend/src/routes/scribeAi.ts` — prompt update only
- `backend/src/routes/scribeAi.test.ts` — update 1 assertion + add 1 test
- `src/components/scribe-standalone/FocusedAIPanel.tsx` — clarify phase render block + local state
- `src/components/scribe-standalone/FocusedAIPanel.test.tsx` — update + 4 new tests

## Files NOT Changed
- `ScribeNotePage.tsx` — no prop changes needed
- `SuggestionFlow` type — no structural change
- `handleOptionSelected` — unchanged, receives text string either way
