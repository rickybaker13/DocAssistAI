# Focused AI: Multi-Select Suggestions + Guideline Citations

**Date:** 2026-02-24
**Status:** Approved

---

## Problem

The Focused AI panel closes immediately after a single suggestion is confirmed, making it tedious to add multiple suggestions — the user must re-open the panel for every item. There is also no way to add the displayed guideline citations to the note.

---

## Goals

1. Let the user select and add multiple (or all) suggestions without re-opening the panel.
2. Keep the panel open after applying suggestions; user closes it explicitly with ×.
3. Add "Add citation" to each guideline card, inserting a formatted short blurb.

---

## Interaction Design

### Suggestions section

```
Suggestions                          [Select all]
☑ Document stroke type                    [Add →]
☐ Document vascular territory             [Add →]
☑ Include NIHSS score                     [Add →]

                      [Add selected (2) →]
```

- Each suggestion row has a **checkbox** (left) and an **"Add →"** button (right).
  - Checkbox: selects for batch processing.
  - "Add →" button: opens the existing single clarify → preview flow for that item.
- "**Select all / Deselect all**" toggle in the suggestions header.
- When ≥ 1 box is checked, "**Add selected (N) →**" appears below the list.
- Applied suggestions show a green **✓** and dimmed styling — remain visible for reference.

### Guidelines section

Each citation card gains an **"Add citation"** button. Clicking it formats and applies directly, no AI call:

```
Per AHA/ASA (2023) guidelines: Determine stroke type to guide reperfusion therapy decisions.
```

Applied citations also show ✓ feedback.

---

## Batch Serial Queue (Option A — Smart)

When "Add selected (N) →" is clicked:

1. A `batchQueueRef` (React ref, avoids stale closures) is filled with selected suggestion indices; `batchTotal` state records N.
2. The first suggestion is processed through `POST /api/ai/scribe/resolve-suggestion` — same flow as single mode.
3. The overlay shows **"Processing 2 of 3…"** for progress.
4. On **Confirm**: note text is applied; that row gets ✓; next item in the queue starts automatically (overlay stays visible).
5. If clarification is needed (`ready: false`), the clarify overlay pauses for user input, then continues to the next item on confirm.
6. **Cancel**: clears remaining queue; items already applied stay in the note.
7. When queue empties: overlay dismisses; all applied rows show ✓.

---

## State Changes — `FocusedAIPanel`

| New state / ref | Type | Purpose |
|---|---|---|
| `selectedSuggestions` | `Set<number>` | Checked suggestion indices |
| `addedIndices` | `Set<number>` | Applied suggestion/citation indices (visual ✓) |
| `batchQueueRef` | `React.MutableRefObject<number[]>` | Remaining batch queue (ref avoids stale closure) |
| `batchTotal` | `number` | Total items in current batch (for "N of M" display) |

**`SuggestionFlow` type:** Add `suggestionIndex: number` to `loading`, `clarify`, and `resolving` phases so `handleConfirm` knows which index to mark as added and which to start next.

**`handleConfirm`:** Remove `onClose()` call. After applying, mark `addedIndices`, dequeue next item from `batchQueueRef` and start it (or close overlay if queue empty).

---

## Parent Change — `ScribeNotePage`

Remove `setFocusedSection(null)` from `handleApplySuggestion`. The panel only closes when:
- User clicks ×
- User clicks the backdrop

`handleChatInsert` already omits this close — this aligns behavior.

---

## Guideline Citation Handler

```tsx
const handleAddCitation = useCallback((c: Citation, citationIndex: number) => {
  const text = `Per ${c.guideline}${c.year ? ` (${c.year})` : ''} guidelines: ${c.recommendation}`;
  onApplySuggestion(section!.id, text);
  setAddedIndices(prev => new Set([...prev, CITATION_OFFSET + citationIndex]));
}, [section, onApplySuggestion]);
```

Citation indices are offset by a constant (e.g. 1000) to share the same `addedIndices` set without collisions with suggestion indices.

---

## Files Changed

| File | Change |
|---|---|
| `src/components/scribe-standalone/FocusedAIPanel.tsx` | Main UI + batch queue logic |
| `src/components/scribe-standalone/ScribeNotePage.tsx` | Remove `setFocusedSection(null)` from `handleApplySuggestion` |
| `src/components/scribe-standalone/FocusedAIPanel.test.tsx` | New tests |

**No backend changes needed.**

---

## Tests to Add

- Panel stays open after confirming a suggestion (no `setFocusedSection(null)`)
- Checkbox toggles suggestion selection
- "Select all" selects all suggestions
- "Add selected (N)" triggers batch queue for N items
- Batch auto-advances to next item after confirm
- Cancel mid-batch clears remaining queue
- Applied suggestion shows in addedIndices (visual feedback)
- "Add citation" applies formatted text and marks citation as added
- `suggestionIndex` propagates through all SuggestionFlow phases
