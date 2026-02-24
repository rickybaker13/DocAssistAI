# Focused AI Multi-Select Suggestions + Guideline Citations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users select and add multiple AI suggestions and guideline citations to a note without the panel closing between items.

**Architecture:** Three frontend-only changes — (1) remove auto-close from `handleConfirm` and parent `handleApplySuggestion`, (2) add checkbox multi-select with a serial batch queue using a ref to avoid stale closures, (3) add "Add citation" buttons that format guideline text client-side. No backend changes needed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

---

### Task 1: Panel stays open — remove auto-close on apply

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx` (line ~156–161)
- Modify: `src/components/scribe-standalone/ScribeNotePage.tsx` (line ~143–149)
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing test**

Add to `FocusedAIPanel.test.tsx` inside `describe('FocusedAIPanel')`:

```tsx
it('does not call onClose after confirming a suggestion', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Ischemic stroke left MCA."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getAllByRole('button', { name: /add to note/i })[0]);
  await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

  expect(onClose).not.toHaveBeenCalled();
  expect(onApplySuggestion).toHaveBeenCalledWith('sec-1', 'Ischemic stroke, left MCA territory.');
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — `onClose` was called (currently called in `handleConfirm`).

**Step 3: Fix `handleConfirm` in `FocusedAIPanel.tsx`**

Find `handleConfirm` (~line 156). Remove the `onClose()` call:

```tsx
const handleConfirm = useCallback(() => {
  if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
  onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
  setSuggestionFlow(null);
  // ← onClose() removed; panel stays open for further additions
}, [suggestionFlow, onApplySuggestion]);
```

**Step 4: Fix `handleApplySuggestion` in `ScribeNotePage.tsx`**

Find `handleApplySuggestion` (~line 143). Remove `setFocusedSection(null)`:

```tsx
const handleApplySuggestion = (sectionId: string, suggestion: string) => {
  setEdits(prev => ({
    ...prev,
    [sectionId]: (prev[sectionId] ? prev[sectionId] + '\n' : '') + suggestion,
  }));
  // ← setFocusedSection(null) removed; panel only closes on explicit × click
};
```

**Step 5: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/
```

Expected: all tests pass (11 in FocusedAIPanel, others unchanged).

**Step 6: Commit**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/ScribeNotePage.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): keep Focused AI panel open after applying a suggestion

Remove auto-close from handleConfirm and handleApplySuggestion so the
panel stays open after adding a suggestion. User closes with × explicitly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: SuggestionFlow `suggestionIndex` + `addedSuggestionIndices` visual feedback

Each suggestion must track which index it belongs to so the batch queue and visual ✓ feedback know which row was applied.

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing test**

Add to `FocusedAIPanel.test.tsx`:

```tsx
it('shows ✓ Added on a suggestion after it is confirmed', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ready: true, noteText: 'Ischemic stroke.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Ischemic."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getAllByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getAllByRole('button', { name: /add to note/i })[0]);
  await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

  await waitFor(() => expect(screen.getByText('✓ Added')).toBeInTheDocument());
  // The "Add to note" button for that suggestion should be gone
  expect(screen.queryAllByRole('button', { name: /add to note/i })).toHaveLength(0);
});
```

**Step 2: Run to verify fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — "✓ Added" not found.

**Step 3: Extend `SuggestionFlow` type**

In `FocusedAIPanel.tsx`, replace the `SuggestionFlow` type:

```tsx
type SuggestionFlow =
  | { phase: 'loading'; suggestion: string; sectionId: string; suggestionIndex: number }
  | { phase: 'clarify'; suggestion: string; sectionId: string; question: string; options: string[]; suggestionIndex: number }
  | { phase: 'resolving'; suggestion: string; sectionId: string; selectedOption: string; suggestionIndex: number }
  | { phase: 'preview'; sectionId: string; noteText: string; suggestionIndex: number }
  | null;
```

**Step 4: Add `addedSuggestionIndices` state and refactor**

Below the existing state declarations (~line 44), add:

```tsx
const [addedSuggestionIndices, setAddedSuggestionIndices] = useState<Set<number>>(new Set());
```

**Step 5: Extract `startSuggestionProcessing` (replaces inline logic in `handleAddToNote`)**

This separation allows the batch queue to call it without triggering the guard.

Replace the current `handleAddToNote` implementation with:

```tsx
// Core async processing — no guard, called by both single and batch flows
const startSuggestionProcessing = useCallback(async (suggestion: string, index: number) => {
  if (!section) return;
  setSuggestionFlow({ phase: 'loading', suggestion, sectionId: section.id, suggestionIndex: index });
  try {
    const controller = new AbortController();
    flowAbortRef.current = controller;
    const res = await fetch(`${getBackendUrl()}/api/ai/scribe/resolve-suggestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        suggestion,
        sectionName: section.section_name,
        existingContent: section.content || '',
        transcript: transcript.slice(0, 800),
        noteType,
        verbosity,
      }),
    });
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    const data = await res.json();
    if (data.ready) {
      setSuggestionFlow({ phase: 'preview', sectionId: section.id, noteText: data.noteText, suggestionIndex: index });
    } else {
      setSuggestionFlow({
        phase: 'clarify',
        suggestion,
        sectionId: section.id,
        question: data.question,
        options: data.options,
        suggestionIndex: index,
      });
      setShowFreeText(false);
      setFreeTextValue('');
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    setError(e instanceof Error ? e.message : 'Failed to process suggestion. Please try again.');
    setSuggestionFlow(null);
  }
}, [section, transcript, noteType, verbosity]);

// Guard wrapper — used by "Add →" buttons (prevents concurrent flows)
const handleAddToNote = useCallback((suggestion: string, index: number) => {
  if (!section || suggestionFlow !== null) return;
  startSuggestionProcessing(suggestion, index);
}, [section, suggestionFlow, startSuggestionProcessing]);
```

**Step 6: Update `handleOptionSelected` to carry `suggestionIndex` through**

```tsx
const handleOptionSelected = useCallback(async (option: string) => {
  if (!suggestionFlow || suggestionFlow.phase !== 'clarify') return;
  const { suggestion, sectionId, suggestionIndex } = suggestionFlow;
  setSuggestionFlow({ phase: 'resolving', suggestion, sectionId, selectedOption: option, suggestionIndex });
  try {
    const controller = new AbortController();
    flowAbortRef.current = controller;
    const res = await fetch(`${getBackendUrl()}/api/ai/scribe/ghost-write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        chatAnswer: `${suggestion}. ${option}.`,
        destinationSection: section?.section_name || '',
        existingContent: section?.content || '',
        noteType,
        verbosity,
      }),
    });
    if (!res.ok) throw new Error(`Failed (${res.status})`);
    const data = await res.json();
    setSuggestionFlow({ phase: 'preview', sectionId, noteText: data.ghostWritten, suggestionIndex });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    setError(e instanceof Error ? e.message : 'Failed to process suggestion. Please try again.');
    setSuggestionFlow(null);
  }
}, [suggestionFlow, section, noteType, verbosity]);
```

**Step 7: Update `handleConfirm` to mark addedSuggestionIndices**

```tsx
const handleConfirm = useCallback(() => {
  if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
  onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
  setAddedSuggestionIndices(prev => new Set([...prev, suggestionFlow.suggestionIndex]));
  setSuggestionFlow(null);
}, [suggestionFlow, onApplySuggestion]);
```

**Step 8: Update suggestion row render to show ✓ Added**

In the suggestions `.map()` section (~line 219–232), change the per-row render:

```tsx
{result.suggestions.map((s, i) => (
  <div key={i} className={`flex items-start gap-2 text-sm py-1 ${addedSuggestionIndices.has(i) ? 'opacity-50' : ''}`}>
    <span className="text-orange-500 mt-0.5">•</span>
    <span className="flex-1 text-gray-700">{s}</span>
    {addedSuggestionIndices.has(i) ? (
      <span className="text-xs text-green-600 font-medium flex-shrink-0">✓ Added</span>
    ) : (
      <button
        onClick={() => handleAddToNote(s, i)}
        aria-label="Add to note"
        className="text-xs text-blue-600 hover:underline flex-shrink-0"
      >
        Add to note
      </button>
    )}
  </div>
))}
```

**Step 9: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: all 12 tests pass. Note: existing tests that call `handleAddToNote(s)` with a single arg will need updating to pass a second `index` argument — check for TypeScript errors and fix: `handleAddToNote(s, 0)` or the index appropriate for the test.

**Step 10: Commit**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): track suggestionIndex through flow + ✓ Added visual feedback

Extend SuggestionFlow phases with suggestionIndex, extract
startSuggestionProcessing for guard-free batch use, mark applied
suggestions with green ✓ and dimmed styling.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Checkbox multi-select UI

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing tests**

```tsx
it('renders a checkbox for each suggestion', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByText('Document stroke type (ischemic vs hemorrhagic)'));
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes).toHaveLength(focusedResult.suggestions.length);
});

it('checking a suggestion checkbox selects it for batch', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getAllByRole('checkbox'));
  const [firstCheckbox] = screen.getAllByRole('checkbox');
  expect(firstCheckbox).not.toBeChecked();
  fireEvent.click(firstCheckbox);
  expect(firstCheckbox).toBeChecked();
});
```

**Step 2: Run to verify fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — no checkboxes found.

**Step 3: Add `selectedSuggestions` state**

Below the `addedSuggestionIndices` state declaration, add:

```tsx
const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
```

**Step 4: Add toggle handler**

```tsx
const handleToggleSuggestion = useCallback((index: number) => {
  setSelectedSuggestions(prev => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });
}, []);
```

**Step 5: Update suggestion row render to add checkboxes**

Replace the suggestions `.map()` with:

```tsx
{result.suggestions.map((s, i) => (
  <div key={i} className={`flex items-center gap-2 text-sm py-1 ${addedSuggestionIndices.has(i) ? 'opacity-50' : ''}`}>
    <input
      type="checkbox"
      checked={selectedSuggestions.has(i)}
      onChange={() => handleToggleSuggestion(i)}
      disabled={addedSuggestionIndices.has(i)}
      aria-label={`Select suggestion: ${s}`}
      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 flex-shrink-0"
    />
    <span className="text-orange-500">•</span>
    <span className="flex-1 text-gray-700">{s}</span>
    {addedSuggestionIndices.has(i) ? (
      <span className="text-xs text-green-600 font-medium flex-shrink-0">✓ Added</span>
    ) : (
      <button
        onClick={() => handleAddToNote(s, i)}
        aria-label="Add to note"
        className="text-xs text-blue-600 hover:underline flex-shrink-0"
      >
        Add →
      </button>
    )}
  </div>
))}
```

**Step 6: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): add checkbox multi-select UI to suggestions

Each suggestion row gets a checkbox. Disabled and dimmed after the
suggestion is applied. selectedSuggestions Set tracks checked state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: "Select all" toggle + "Add selected (N)" button + batch queue infrastructure

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing tests**

```tsx
it('"Select all" button selects all suggestions', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /select all/i }));
  fireEvent.click(screen.getByRole('button', { name: /select all/i }));

  const checkboxes = screen.getAllByRole('checkbox');
  checkboxes.forEach(cb => expect(cb).toBeChecked());
});

it('"Add selected (N)" button appears when suggestions are checked', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getAllByRole('checkbox'));
  // Before checking: button absent
  expect(screen.queryByRole('button', { name: /add selected/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  // After checking one: button appears with count
  expect(screen.getByRole('button', { name: /add selected \(1\)/i })).toBeInTheDocument();
});
```

**Step 2: Run to verify fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — "Select all" button and "Add selected" button not found.

**Step 3: Add batch queue infrastructure**

Below the `selectedSuggestions` state, add:

```tsx
const batchQueueRef = useRef<number[]>([]);
const [batchTotal, setBatchTotal] = useState(0);
```

**Step 4: Add `handleSelectAll` and `handleBatchAdd`**

```tsx
const handleSelectAll = useCallback(() => {
  if (!result) return;
  const allUnaddedIndices = result.suggestions
    .map((_, i) => i)
    .filter(i => !addedSuggestionIndices.has(i));
  setSelectedSuggestions(
    selectedSuggestions.size === allUnaddedIndices.length
      ? new Set()
      : new Set(allUnaddedIndices)
  );
}, [result, addedSuggestionIndices, selectedSuggestions]);

const handleBatchAdd = useCallback(() => {
  if (!section || !result || selectedSuggestions.size === 0) return;
  const indices = [...selectedSuggestions]
    .filter(i => !addedSuggestionIndices.has(i))
    .sort((a, b) => a - b);
  if (indices.length === 0) return;
  const [first, ...rest] = indices;
  batchQueueRef.current = rest;
  setBatchTotal(indices.length);
  setSelectedSuggestions(new Set());
  startSuggestionProcessing(result.suggestions[first], first);
}, [section, result, selectedSuggestions, addedSuggestionIndices, startSuggestionProcessing]);
```

**Step 5: Add "Select all" and "Add selected" to the suggestions section header + footer**

Replace the suggestions section header `<h3>`:

```tsx
<div className="flex items-center justify-between mb-2">
  <h3 className="text-xs font-semibold text-gray-500 uppercase">Suggestions</h3>
  {result.suggestions.length > 0 && (
    <button
      onClick={handleSelectAll}
      className="text-xs text-blue-600 hover:underline"
    >
      {selectedSuggestions.size > 0 && selectedSuggestions.size === result.suggestions.filter((_, i) => !addedSuggestionIndices.has(i)).length
        ? 'Deselect all'
        : 'Select all'}
    </button>
  )}
</div>
```

After the suggestions `.map()`, add:

```tsx
{selectedSuggestions.size > 0 && (
  <button
    onClick={handleBatchAdd}
    className="mt-3 w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
  >
    Add selected ({selectedSuggestions.size}) →
  </button>
)}
```

**Step 6: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): Select all toggle + Add selected (N) batch button

batchQueueRef and batchTotal state added. handleBatchAdd dequeues
selected suggestions and starts serial processing via startSuggestionProcessing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Batch auto-advance + progress display + cancel clears queue

After confirming each item in the batch, `handleConfirm` should automatically start the next item.

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing test**

```tsx
it('batch auto-advances to next suggestion after confirm', async () => {
  const batchResult = {
    ...focusedResult,
    suggestions: [
      'Document stroke type (ischemic vs hemorrhagic)',
      'Document vascular territory',
    ],
  };

  // focused analysis
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => batchResult });
  // resolve-suggestion for suggestion 0 (ready immediately)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ready: true, noteText: 'Ischemic stroke.' }),
  });
  // resolve-suggestion for suggestion 1 (ready immediately)
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ready: true, noteText: 'Left MCA territory.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  // Select all and click Add selected
  await waitFor(() => screen.getByRole('button', { name: /select all/i }));
  fireEvent.click(screen.getByRole('button', { name: /select all/i }));
  fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

  // First item: confirm
  await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

  // Second item should start automatically
  await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

  expect(onApplySuggestion).toHaveBeenCalledTimes(2);
  expect(onApplySuggestion).toHaveBeenNthCalledWith(1, 'sec-1', 'Ischemic stroke.');
  expect(onApplySuggestion).toHaveBeenNthCalledWith(2, 'sec-1', 'Left MCA territory.');
});

it('cancel mid-batch clears remaining queue', async () => {
  const batchResult = {
    ...focusedResult,
    suggestions: [
      'Document stroke type (ischemic vs hemorrhagic)',
      'Document vascular territory',
    ],
  };

  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => batchResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ready: true, noteText: 'Ischemic stroke.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /select all/i }));
  fireEvent.click(screen.getByRole('button', { name: /select all/i }));
  fireEvent.click(screen.getByRole('button', { name: /add selected/i }));

  // Cancel during preview of first item
  await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  // Overlay dismissed; onApplySuggestion not called
  expect(onApplySuggestion).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
});
```

**Step 2: Run to verify fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — second confirm button never appears (batch doesn't auto-advance).

**Step 3: Update `handleConfirm` to auto-advance**

```tsx
const handleConfirm = useCallback(() => {
  if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
  onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
  setAddedSuggestionIndices(prev => new Set([...prev, suggestionFlow.suggestionIndex]));

  const nextQueue = [...batchQueueRef.current];
  const nextIndex = nextQueue.shift();
  batchQueueRef.current = nextQueue;

  if (nextIndex !== undefined && result && section) {
    // Auto-advance: start next batch item (transitions preview → loading)
    startSuggestionProcessing(result.suggestions[nextIndex], nextIndex);
  } else {
    setSuggestionFlow(null);
    if (batchTotal > 0) setBatchTotal(0);
  }
}, [suggestionFlow, onApplySuggestion, result, section, batchTotal, startSuggestionProcessing]);
```

**Step 4: Update cancel buttons to also clear batch queue**

In all three cancel button `onClick` handlers within the overlay (loading, clarify, preview phases), also reset batch state:

```tsx
onClick={() => {
  flowAbortRef.current?.abort();
  setSuggestionFlow(null);
  batchQueueRef.current = [];
  setBatchTotal(0);
}}
```

**Step 5: Add "Processing N of M…" to the loading overlay**

In the loading phase render block, replace the static text:

```tsx
{suggestionFlow.phase === 'loading' && (
  <>
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
      <span>
        {batchTotal > 1
          ? `Processing ${addedSuggestionIndices.size + 1} of ${batchTotal}…`
          : 'Preparing note text...'}
      </span>
    </div>
    <button
      onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); batchQueueRef.current = []; setBatchTotal(0); }}
      className="text-xs text-gray-400 hover:text-gray-600"
    >
      Cancel
    </button>
  </>
)}
```

**Step 6: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: all tests pass.

**Step 7: Commit**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): batch serial queue auto-advances through selected suggestions

handleConfirm pops batchQueueRef and calls startSuggestionProcessing for
next item. Cancel clears remaining queue. Loading shows 'Processing N of M'.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Guideline citation "Add citation" button

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

---

**Step 1: Write the failing tests**

```tsx
it('"Add citation" button appears on each guideline card', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByText('AHA/ASA'));
  expect(screen.getByRole('button', { name: /add citation/i })).toBeInTheDocument();
});

it('"Add citation" applies formatted guideline text to the note', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add citation/i }));
  fireEvent.click(screen.getByRole('button', { name: /add citation/i }));

  expect(onApplySuggestion).toHaveBeenCalledWith(
    'sec-1',
    'Per AHA/ASA (2023) guidelines: Determine stroke type.'
  );
});

it('citation shows ✓ Added after being added', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="x"
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add citation/i }));
  fireEvent.click(screen.getByRole('button', { name: /add citation/i }));

  // Button replaced by ✓ Added
  expect(screen.queryByRole('button', { name: /add citation/i })).not.toBeInTheDocument();
  expect(screen.getByText('✓ Added')).toBeInTheDocument();
});
```

Note: the `focusedResult` mock has `recommendation: 'Determine stroke type.'` — verify this matches what's in the test file setup. Adjust if needed.

**Step 2: Run to verify fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: FAIL — "Add citation" button not found.

**Step 3: Add `addedCitationIndices` state**

```tsx
const [addedCitationIndices, setAddedCitationIndices] = useState<Set<number>>(new Set());
```

**Step 4: Add `handleAddCitation` handler**

```tsx
const handleAddCitation = useCallback((c: { guideline: string; year?: string; recommendation: string }, index: number) => {
  if (!section) return;
  const text = `Per ${c.guideline}${c.year ? ` (${c.year})` : ''} guidelines: ${c.recommendation}`;
  onApplySuggestion(section.id, text);
  setAddedCitationIndices(prev => new Set([...prev, index]));
}, [section, onApplySuggestion]);
```

**Step 5: Update citations render to add the button**

Replace the citations `.map()` render block:

```tsx
{result.citations.map((c, i) => (
  <div key={i} className="bg-blue-50 rounded-lg p-2 mb-2 text-sm">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1">
        <p className="font-medium text-blue-800">{c.guideline}{c.year && ` (${c.year})`}</p>
        <p className="text-blue-700 text-xs mt-0.5">{c.recommendation}</p>
      </div>
      {addedCitationIndices.has(i) ? (
        <span className="text-xs text-green-600 font-medium flex-shrink-0 mt-0.5">✓ Added</span>
      ) : (
        <button
          onClick={() => handleAddCitation(c, i)}
          aria-label="Add citation"
          className="text-xs text-blue-600 hover:underline flex-shrink-0 mt-0.5"
        >
          Add citation
        </button>
      )}
    </div>
  </div>
))}
```

**Step 6: Run all tests to verify pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx
```

Expected: all tests pass. Run full suite too:

```bash
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/
```

Expected: all 42+ tests pass across all scribe components.

**Step 7: Commit and push**

```bash
git add src/components/scribe-standalone/FocusedAIPanel.tsx \
        src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): Add citation button on guideline cards

handleAddCitation formats 'Per [guideline] ([year]) guidelines: [recommendation]'
and applies directly without AI call. addedCitationIndices tracks ✓ Added state.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push
```

---

## Final Verification

After all 6 tasks:

```bash
# Backend tests
cd /Users/bitbox/Documents/DocAssistAI/backend && \
  node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage

# Frontend tests
cd /Users/bitbox/Documents/DocAssistAI && npx vitest run src/components/scribe-standalone/
```

Expected: 17 backend + 45+ frontend tests all green.
