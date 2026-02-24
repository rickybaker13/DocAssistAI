# Clarify 3+1 Free-Text Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current generic fixed-option clarify overlay with a 3+1 model: 3 AI-generated case-specific common answers (fast tap) plus an "Other…" pill that reveals a free-text input for anything not covered.

**Architecture:** The backend `resolve-suggestion` prompt is updated to always return exactly 3 case-specific options (no generic escapes). The frontend `FocusedAIPanel` clarify phase gains two local state variables (`showFreeText`, `freeTextValue`) and an "Other…" pill that toggles a text input. `handleOptionSelected` is unchanged — it receives whatever text the user picked or typed.

**Tech Stack:** Express/TypeScript backend with Jest (ESM mode); React/TypeScript frontend with Vitest + React Testing Library.

---

### Task 1: Backend — update `resolve-suggestion` to emit exactly 3 case-specific options

**Files:**
- Modify: `backend/src/routes/scribeAi.ts` (lines 238–260, the systemPrompt and userPrompt strings)
- Modify: `backend/src/routes/scribeAi.test.ts` (update 1 assertion + add 1 test)

**Step 1: Update the failing tests first**

In `backend/src/routes/scribeAi.test.ts`, inside the `describe('POST /resolve-suggestion', ...)` block, make these two changes:

a) In the `ready=false` test, change this assertion:
```ts
expect(res.body.options.length).toBeGreaterThanOrEqual(2);
```
To:
```ts
expect(res.body.options.length).toBe(3);
```

b) Add a new test after the existing four, before the closing `});` of the describe block:
```ts
it('ready=false options do not include generic escape text', async () => {
  mockAiChat.mockResolvedValueOnce({
    content: JSON.stringify({
      ready: false,
      question: 'What artery was involved?',
      options: ['Left MCA', 'Right MCA', 'Basilar artery'],
    }),
  } as any);

  const res = await request(app)
    .post('/api/ai/scribe/resolve-suggestion')
    .set('Cookie', authCookie)
    .send({
      suggestion: 'Document vascular territory',
      sectionName: 'Assessment',
      transcript: 'Patient with acute stroke symptoms.',
      noteType: 'progress_note',
      verbosity: 'standard',
    });

  expect(res.status).toBe(200);
  expect(res.body.ready).toBe(false);
  expect(res.body.options.length).toBe(3);
  // No vague escape options — the UI handles that with "Other…"
  const escapeTerms = ['not yet', 'unknown', 'not determined', 'tbd'];
  res.body.options.forEach((opt: string) => {
    expect(escapeTerms.some(t => opt.toLowerCase().includes(t))).toBe(false);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage 2>&1 | tail -20
```

Expected: the `>= 2` → `=== 3` test now fails (existing mock returns 3 options so it may pass), and the new "no escape terms" test fails because the mock returns "Not yet determined". Confirm at least the escape-terms test fails.

**Step 3: Update the `resolve-suggestion` prompt in `scribeAi.ts`**

Find the `systemPrompt` string in the `resolve-suggestion` handler (around line 238). Replace the entire `systemPrompt` and `userPrompt` constants with:

```ts
const systemPrompt = `You are a clinical documentation AI for a ${specialty} physician. Your job is to convert a documentation suggestion into actual physician note text.

First, search the provided transcript and existing section content for the clinical detail referenced in the suggestion.
- If the detail is present or unambiguously inferable → write the note text and return ready=true.
- If a clinically critical detail is genuinely absent → return ready=false with a single focused clinical question and exactly 3 options.

Rules for options when ready=false:
- Provide exactly 3 options — the most clinically common and specific answers to your question given this case context.
- Options must be real clinical values (e.g. "Left MCA", "HFrEF", "EF 35%") — not vague placeholders.
- Do NOT include escape options like "Not yet determined", "Unknown", or "Other" — the UI provides a free-text fallback.

Rules for note text when ready=true:
${verbosityInstruction}
Never include the suggestion text itself, meta-commentary, caveats, or guidance — only note-ready clinical content.

Return ONLY valid JSON. No markdown fences. No extra text.`;

  const userPrompt = `Suggestion to resolve: "${suggestion}"

Section: ${sectionName}
Note type: ${noteType}
Specialty: ${specialty}
${existingContent ? `Existing section content:\n"${existingContent.slice(0, 400)}"` : ''}
${transcript ? `Transcript excerpt:\n"${transcript.slice(0, 800)}"` : ''}

Return one of these two JSON shapes:
{ "ready": true, "noteText": "..." }
{ "ready": false, "question": "...", "options": ["<specific value>", "<specific value>", "<specific value>"] }`;
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage 2>&1 | tail -20
```

Expected: all tests pass (the new "no escape terms" test passes because the mock now returns clean clinical options).

**Step 5: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add backend/src/routes/scribeAi.ts backend/src/routes/scribeAi.test.ts
git commit -m "feat(scribe): resolve-suggestion emits 3 case-specific options, no generic escapes"
```

---

### Task 2: Frontend — "Other…" pill + free-text input in clarify phase

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Modify: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

**Step 1: Write the new failing tests**

In `FocusedAIPanel.test.tsx`, make these changes:

a) Update the existing `'shows clarify overlay with question and options when ready=false'` test. The mock now returns **3** options (no "Not yet determined"). Also assert the "Other…" pill is always present:

```tsx
it('shows clarify overlay with question and options when ready=false', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ready: false,
      question: 'What type of stroke?',
      options: ['Ischemic', 'Hemorrhagic', 'Embolic'],
    }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Patient has neuro deficits."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

  await waitFor(() => expect(screen.getByText('What type of stroke?')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Ischemic' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hemorrhagic' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Embolic' })).toBeInTheDocument();
  // "Other…" is always appended by the frontend
  expect(screen.getByRole('button', { name: /other/i })).toBeInTheDocument();
});
```

b) Also update the `'dismisses overlay on cancel'` test mock to return 3 options without "Not yet determined":
```tsx
// change options array from ['Ischemic', 'Hemorrhagic', 'Not yet determined']
// to ['Ischemic', 'Hemorrhagic', 'Embolic']
```

c) Add four new tests after `'dismisses overlay on cancel'`:

```tsx
it('clicking Other… reveals free-text input', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ready: false,
      question: 'What artery was involved?',
      options: ['Left MCA', 'Right MCA', 'Basilar artery'],
    }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Stroke patient."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
  await waitFor(() => screen.getByRole('button', { name: /other/i }));
  fireEvent.click(screen.getByRole('button', { name: /other/i }));

  expect(screen.getByRole('textbox')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
});

it('submitting free-text calls handleOptionSelected with typed value', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ready: false,
      question: 'What artery was involved?',
      options: ['Left MCA', 'Right MCA', 'Basilar artery'],
    }),
  });
  // Third fetch: ghost-write after free-text submission
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ghostWritten: 'Right PCA territory infarct.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Stroke patient."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
  await waitFor(() => screen.getByRole('button', { name: /other/i }));
  fireEvent.click(screen.getByRole('button', { name: /other/i }));

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Right PCA' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() =>
    expect(screen.getByText('Right PCA territory infarct.')).toBeInTheDocument()
  );
});

it('back link in free-text view returns to pill view', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ready: false,
      question: 'What artery was involved?',
      options: ['Left MCA', 'Right MCA', 'Basilar artery'],
    }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Stroke patient."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
  await waitFor(() => screen.getByRole('button', { name: /other/i }));
  fireEvent.click(screen.getByRole('button', { name: /other/i }));

  // In free-text view, pills are hidden
  expect(screen.queryByRole('button', { name: 'Left MCA' })).not.toBeInTheDocument();

  // Click back
  fireEvent.click(screen.getByRole('button', { name: /back/i }));

  // Pills are visible again
  expect(screen.getByRole('button', { name: 'Left MCA' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('Enter key submits free-text input', async () => {
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ready: false,
      question: 'What artery was involved?',
      options: ['Left MCA', 'Right MCA', 'Basilar artery'],
    }),
  });
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ghostWritten: 'Right PCA territory infarct.' }),
  });

  render(
    <FocusedAIPanel
      section={mockSection}
      transcript="Stroke patient."
      noteType="progress_note"
      verbosity="standard"
      onClose={onClose}
      onApplySuggestion={onApplySuggestion}
    />
  );

  await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
  fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
  await waitFor(() => screen.getByRole('button', { name: /other/i }));
  fireEvent.click(screen.getByRole('button', { name: /other/i }));

  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Right PCA' } });
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

  await waitFor(() =>
    expect(screen.getByText('Right PCA territory infarct.')).toBeInTheDocument()
  );
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx 2>&1 | tail -20
```

Expected: 4 new tests fail (no "Other…" button, no textbox, no back button). The updated clarify test also fails if "Not yet determined" is still asserted.

**Step 3: Implement the changes in `FocusedAIPanel.tsx`**

Add two local state variables immediately after the existing `suggestionFlow` state (around line 44):

```tsx
const [showFreeText, setShowFreeText] = useState(false);
const [freeTextValue, setFreeTextValue] = useState('');
```

Reset both when the clarify phase is entered or exited. In `handleAddToNote`, when setting the `clarify` phase:
```tsx
setSuggestionFlow({ phase: 'clarify', ... });
setShowFreeText(false);
setFreeTextValue('');
```

Add a submit handler for the free-text path:
```tsx
const handleFreeTextSubmit = useCallback(() => {
  if (!freeTextValue.trim()) return;
  handleOptionSelected(freeTextValue.trim());
  setShowFreeText(false);
  setFreeTextValue('');
}, [freeTextValue, handleOptionSelected]);
```

Replace the entire clarify phase render block (currently lines 251–272) with:

```tsx
{/* Clarify phase */}
{suggestionFlow.phase === 'clarify' && (
  <>
    <p className="text-sm font-semibold text-gray-900">{suggestionFlow.question}</p>

    {!showFreeText ? (
      <>
        <div className="flex flex-wrap gap-2">
          {suggestionFlow.options.map(opt => (
            <button
              key={opt}
              onClick={() => handleOptionSelected(opt)}
              className="px-3 py-1.5 rounded-full text-sm text-gray-800 border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              {opt}
            </button>
          ))}
          <button
            onClick={() => { setShowFreeText(true); setFreeTextValue(''); }}
            className="px-3 py-1.5 rounded-full text-sm text-gray-500 border border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            Other…
          </button>
        </div>
        <button
          onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </>
    ) : (
      <>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeTextValue}
            onChange={e => setFreeTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFreeTextSubmit(); }}
            placeholder="Type your answer…"
            autoFocus
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleFreeTextSubmit}
            disabled={!freeTextValue.trim()}
            aria-label="Submit"
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Submit
          </button>
        </div>
        <button
          onClick={() => setShowFreeText(false)}
          aria-label="Back"
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← back
        </button>
        <button
          onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); setShowFreeText(false); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </>
    )}
  </>
)}
```

**Step 4: Run tests to confirm all pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx 2>&1 | tail -20
```

Expected: all 10 tests pass (6 existing + 4 new). If any fail, debug before committing.

**Step 5: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add src/components/scribe-standalone/FocusedAIPanel.tsx src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): clarify overlay 3+1 — Other… pill reveals free-text input"
```

---

### Task 3: Final verification and push

**Step 1: Run full backend scribe tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage 2>&1 | tail -20
```

Expected: all tests pass.

**Step 2: Run full frontend scribe-standalone tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/ 2>&1 | tail -20
```

Expected: all tests pass.

**Step 3: Push to GitHub**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git push origin main
```
