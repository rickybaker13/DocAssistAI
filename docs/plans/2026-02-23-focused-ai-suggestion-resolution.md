# Focused AI Suggestion Resolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the verbatim suggestion-text dump with a smart two-call flow: resolve-suggestion detects whether it has enough context to write note text or needs one clarifying question, and a small overlay guides the author through clarify → preview → confirm before inserting into the note.

**Architecture:** New `POST /api/ai/scribe/resolve-suggestion` endpoint tries to write note-ready text from the transcript + existing content; if a critical detail is absent it returns a question + quick-select options instead. `FocusedAIPanel` manages a `suggestionFlow` state machine (loading → clarify? → preview) rendered as a small `z-60` overlay above the panel. On confirm, the existing `onApplySuggestion` callback is called with clean note text.

**Tech Stack:** Express/TypeScript backend with better-sqlite3 + Jest tests; React/TypeScript frontend with Vitest + React Testing Library. All AI calls go through `aiService.chat`. Ghost-write endpoint is reused for the clarify → note-text step.

---

### Task 1: Backend — `POST /api/ai/scribe/resolve-suggestion` with tests

**Files:**
- Modify: `backend/src/routes/scribeAi.ts` (add new route before `export default router`)
- Modify: `backend/src/routes/scribeAi.test.ts` (add `describe('POST /resolve-suggestion', ...)`)

**Step 1: Write the failing tests**

Add this `describe` block to `backend/src/routes/scribeAi.test.ts`, inside the outer `describe('Scribe AI Routes', ...)`, after the ghost-write block:

```ts
describe('POST /resolve-suggestion', () => {
  it('returns ready=true with noteText when AI has enough context', async () => {
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .set('Cookie', authCookie)
      .send({
        suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
        sectionName: 'Assessment',
        existingContent: 'Patient with acute neurological deficits.',
        transcript: 'The patient suffered an ischemic stroke involving the left MCA territory.',
        noteType: 'progress_note',
        verbosity: 'standard',
      });

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
    expect(typeof res.body.noteText).toBe('string');
    expect(res.body.noteText.length).toBeGreaterThan(0);
  });

  it('returns ready=false with question and options when AI needs clarification', async () => {
    mockAiChat.mockResolvedValueOnce({
      content: JSON.stringify({
        ready: false,
        question: 'What type of stroke?',
        options: ['Ischemic', 'Hemorrhagic', 'Not yet determined'],
      }),
    } as any);

    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .set('Cookie', authCookie)
      .send({
        suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
        sectionName: 'Assessment',
        existingContent: 'Patient with acute neurological deficits.',
        transcript: 'Patient has new neuro deficits.',
        noteType: 'progress_note',
        verbosity: 'standard',
      });

    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(false);
    expect(typeof res.body.question).toBe('string');
    expect(Array.isArray(res.body.options)).toBe(true);
    expect(res.body.options.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 400 if suggestion is missing', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .set('Cookie', authCookie)
      .send({ sectionName: 'Assessment' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/ai/scribe/resolve-suggestion')
      .send({ suggestion: 'x', sectionName: 'Assessment' });
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot POST /api/ai/scribe/resolve-suggestion` (404)

**Step 3: Implement the route**

Add this block to `backend/src/routes/scribeAi.ts`, between the ghost-write handler and `export default router`:

```ts
// ─── POST /api/ai/scribe/resolve-suggestion ──────────────────────────────────
router.post('/resolve-suggestion', async (req: Request, res: Response) => {
  const {
    suggestion,
    sectionName,
    existingContent = '',
    transcript = '',
    noteType = 'progress_note',
    verbosity = 'standard',
  } = req.body;

  if (!suggestion || !sectionName) {
    return res.status(400).json({ error: 'suggestion and sectionName are required' }) as any;
  }

  const verbosityInstruction =
    verbosity === 'brief'
      ? 'If ready, write in clinical shorthand with medical abbreviations. Sentence fragments OK.'
      : verbosity === 'detailed'
      ? 'If ready, write in complete clinical prose with full reasoning.'
      : 'If ready, write 1–2 concise clinical sentences with medical abbreviations where natural.';

  const systemPrompt = `You are a clinical documentation AI. Your job is to convert a documentation suggestion into actual physician note text.

First, search the provided transcript and existing section content for the clinical detail referenced in the suggestion.
- If you find the detail → write the note text and return ready=true.
- If a clinically critical detail is genuinely absent and cannot be inferred → return ready=false with a single focused question and 2–4 quick-select options. Always include a "Not yet determined" or equivalent escape option.

Rules for note text when ready=true:
${verbosityInstruction}
Never include the suggestion text itself, meta-commentary, caveats, or guidance — only note-ready clinical content.

Return ONLY valid JSON. No markdown fences. No extra text.`;

  const userPrompt = `Suggestion to resolve: "${suggestion}"

Section: ${sectionName}
Note type: ${noteType}
${existingContent ? `Existing section content:\n"${existingContent.slice(0, 400)}"` : ''}
${transcript ? `Transcript excerpt:\n"${transcript.slice(0, 800)}"` : ''}

Return one of these two JSON shapes:
{ "ready": true, "noteText": "..." }
{ "ready": false, "question": "...", "options": ["...", "...", "Not yet determined"] }`;

  try {
    const raw = await aiService.chat(
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        options: { temperature: 0.2 },
      },
      { userId: req.scribeUserId }
    );

    const text = extractContent(raw);
    let parsed: { ready: boolean; noteText?: string; question?: string; options?: string[] };
    try {
      const cleaned = text.replace(/```json?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: treat as ready with the raw text as noteText
      parsed = { ready: true, noteText: text.trim() };
    }

    return res.json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribeAi" --no-coverage 2>&1 | tail -20
```

Expected: all 11 tests PASS

**Step 5: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add backend/src/routes/scribeAi.ts backend/src/routes/scribeAi.test.ts
git commit -m "feat(scribe): add resolve-suggestion endpoint for focused AI suggestion flow"
```

---

### Task 2: Frontend — `FocusedAIPanel` suggestion flow state + overlay UI

**Files:**
- Modify: `src/components/scribe-standalone/FocusedAIPanel.tsx`
- Create: `src/components/scribe-standalone/FocusedAIPanel.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/scribe-standalone/FocusedAIPanel.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FocusedAIPanel } from './FocusedAIPanel';
import { vi } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSection = {
  id: 'sec-1',
  section_name: 'Assessment',
  content: 'Patient with acute neurological deficits.',
};

const focusedResult = {
  analysis: 'Deep analysis here.',
  citations: [{ guideline: 'AHA/ASA', year: '2023', recommendation: 'Determine stroke type.' }],
  suggestions: ['Document stroke type (ischemic vs hemorrhagic)'],
  confidence_breakdown: 'Well supported.',
};

describe('FocusedAIPanel', () => {
  const onClose = vi.fn();
  const onApplySuggestion = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    onClose.mockReset();
    onApplySuggestion.mockReset();
  });

  it('renders analysis and suggestions after loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => focusedResult,
    });

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Patient has neurological deficits."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => expect(screen.getByText('Deep analysis here.')).toBeInTheDocument());
    expect(screen.getByText('Document stroke type (ischemic vs hemorrhagic)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add to note/i })).toBeInTheDocument();
  });

  it('shows loading overlay when Add to note is clicked', async () => {
    // First fetch: focused analysis
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    // Second fetch: resolve-suggestion (pending — stays in loading)
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <FocusedAIPanel
        section={mockSection}
        transcript="Patient has neurological deficits."
        noteType="progress_note"
        verbosity="standard"
        onClose={onClose}
        onApplySuggestion={onApplySuggestion}
      />
    );

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

    expect(screen.getByText(/preparing note text/i)).toBeInTheDocument();
  });

  it('shows clarify overlay with question and options when ready=false', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What type of stroke?',
        options: ['Ischemic', 'Hemorrhagic', 'Not yet determined'],
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
    expect(screen.getByRole('button', { name: 'Not yet determined' })).toBeInTheDocument();
  });

  it('shows preview overlay when ready=true', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));

    await waitFor(() =>
      expect(screen.getByText('Ischemic stroke, left MCA territory.')).toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls onApplySuggestion with note text on confirm', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(onApplySuggestion).toHaveBeenCalledWith('sec-1', 'Ischemic stroke, left MCA territory.');
  });

  it('dismisses overlay on cancel', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => focusedResult });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ready: false,
        question: 'What type of stroke?',
        options: ['Ischemic', 'Hemorrhagic', 'Not yet determined'],
      }),
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

    await waitFor(() => screen.getByRole('button', { name: /add to note/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
    await waitFor(() => screen.getByText('What type of stroke?'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText('What type of stroke?')).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx 2>&1 | tail -20
```

Expected: FAIL — module not found or tests timing out

**Step 3: Rewrite `FocusedAIPanel.tsx`**

Replace the entire file at `src/components/scribe-standalone/FocusedAIPanel.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { getBackendUrl } from '../../config/appConfig';

interface Section {
  id: string;
  section_name: string;
  content: string | null;
}

interface FocusedResult {
  analysis: string;
  citations: Array<{ guideline: string; year?: string; recommendation: string }>;
  suggestions: string[];
  confidence_breakdown?: string;
}

type SuggestionFlow =
  | { phase: 'loading'; suggestion: string; sectionId: string }
  | { phase: 'clarify'; suggestion: string; sectionId: string; question: string; options: string[] }
  | { phase: 'resolving'; suggestion: string; sectionId: string; selectedOption: string }
  | { phase: 'preview'; sectionId: string; noteText: string }
  | null;

interface Props {
  section: Section | null;
  transcript: string;
  noteType: string;
  verbosity: string;
  onClose: () => void;
  onApplySuggestion: (sectionId: string, noteText: string) => void;
}

export const FocusedAIPanel: React.FC<Props> = ({
  section,
  transcript,
  noteType,
  verbosity,
  onClose,
  onApplySuggestion,
}) => {
  const [result, setResult] = useState<FocusedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionFlow, setSuggestionFlow] = useState<SuggestionFlow>(null);

  useEffect(() => {
    if (!section) return;
    const controller = new AbortController();
    setResult(null);
    setSuggestionFlow(null);
    setLoading(true);
    setError(null);
    fetch(`${getBackendUrl()}/api/ai/scribe/focused`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      body: JSON.stringify({
        sectionName: section.section_name,
        content: section.content || '',
        transcript: transcript.slice(0, 1000),
      }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`AI request failed (${r.status})`);
        return r.json();
      })
      .then(d => { setResult(d); setLoading(false); })
      .catch(e => {
        if (e.name === 'AbortError') return;
        setError(e instanceof Error ? e.message : 'Error');
        setLoading(false);
      });
    return () => controller.abort();
  }, [section?.id]);

  const handleAddToNote = useCallback(async (suggestion: string) => {
    if (!section) return;
    setSuggestionFlow({ phase: 'loading', suggestion, sectionId: section.id });
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/scribe/resolve-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        setSuggestionFlow({ phase: 'preview', sectionId: section.id, noteText: data.noteText });
      } else {
        setSuggestionFlow({
          phase: 'clarify',
          suggestion,
          sectionId: section.id,
          question: data.question,
          options: data.options,
        });
      }
    } catch (e) {
      setSuggestionFlow(null);
    }
  }, [section, transcript, noteType, verbosity]);

  const handleOptionSelected = useCallback(async (option: string) => {
    if (!suggestionFlow || suggestionFlow.phase !== 'clarify') return;
    const { suggestion, sectionId } = suggestionFlow;
    setSuggestionFlow({ phase: 'resolving', suggestion, sectionId, selectedOption: option });
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/scribe/ghost-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      setSuggestionFlow({ phase: 'preview', sectionId, noteText: data.ghostWritten });
    } catch (e) {
      setSuggestionFlow(null);
    }
  }, [suggestionFlow, section, noteType, verbosity]);

  const handleConfirm = useCallback(() => {
    if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
    onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
    setSuggestionFlow(null);
    onClose();
  }, [suggestionFlow, onApplySuggestion, onClose]);

  if (!section) return null;

  return (
    <>
      {/* Main panel */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">⚡ Focused AI</h2>
              <p className="text-xs text-gray-500">{section.section_name}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          <div className="p-4 space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                Analyzing...
              </div>
            )}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            {result && (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-1">Analysis</h3>
                  <p className="text-sm text-gray-800">{result.analysis}</p>
                </div>

                {result.citations?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Guideline Citations</h3>
                    {result.citations.map((c, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg p-2 mb-2 text-sm">
                        <p className="font-medium text-blue-800">{c.guideline}{c.year && ` (${c.year})`}</p>
                        <p className="text-blue-700 text-xs mt-0.5">{c.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}

                {result.suggestions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Suggestions</h3>
                    {result.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm py-1">
                        <span className="text-orange-500 mt-0.5">•</span>
                        <span className="flex-1 text-gray-700">{s}</span>
                        <button
                          onClick={() => handleAddToNote(s)}
                          aria-label="Add to note"
                          className="text-xs text-blue-600 hover:underline flex-shrink-0"
                        >
                          Add to note
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion flow overlay */}
      {suggestionFlow && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">

            {/* Loading phase */}
            {suggestionFlow.phase === 'loading' && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                <span>Preparing note text...</span>
              </div>
            )}

            {/* Clarify phase */}
            {suggestionFlow.phase === 'clarify' && (
              <>
                <p className="text-sm font-semibold text-gray-900">{suggestionFlow.question}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestionFlow.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleOptionSelected(opt)}
                      className="px-3 py-1.5 rounded-full text-sm border border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSuggestionFlow(null)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Resolving phase (ghost-writing after option selected) */}
            {suggestionFlow.phase === 'resolving' && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                <span>Writing note text...</span>
              </div>
            )}

            {/* Preview phase */}
            {suggestionFlow.phase === 'preview' && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase">Preview</p>
                <p className="text-sm bg-green-50 border border-green-200 rounded-lg p-3 text-green-900">
                  {suggestionFlow.noteText}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    aria-label="Confirm insert into note"
                    className="flex-1 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Confirm ✓
                  </button>
                  <button
                    onClick={() => setSuggestionFlow(null)}
                    aria-label="Cancel"
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
};
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/FocusedAIPanel.test.tsx 2>&1 | tail -20
```

Expected: all 6 tests PASS

**Step 5: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add src/components/scribe-standalone/FocusedAIPanel.tsx src/components/scribe-standalone/FocusedAIPanel.test.tsx
git commit -m "feat(scribe): smart suggestion resolution in FocusedAIPanel with clarify/preview overlay"
```

---

### Task 3: Wire up `ScribeNotePage` — pass `noteType` and `verbosity` to `FocusedAIPanel`

**Files:**
- Modify: `src/components/scribe-standalone/ScribeNotePage.tsx`

**Step 1: Make the change**

In `src/components/scribe-standalone/ScribeNotePage.tsx`, find the `<FocusedAIPanel` JSX block and update it to pass the two new props:

```tsx
{focusedSection && (
  <FocusedAIPanel
    section={focusedSection}
    transcript={note.transcript || ''}
    noteType={note.note_type}
    verbosity={note.verbosity}
    onClose={() => setFocusedSection(null)}
    onApplySuggestion={handleApplySuggestion}
  />
)}
```

**Step 2: Run the full frontend test suite to confirm nothing is broken**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/ 2>&1 | tail -25
```

Expected: all tests PASS (FocusedAIPanel ×6, ScribeNotePage, ScribeChatDrawer ×4, etc.)

**Step 3: Commit**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git add src/components/scribe-standalone/ScribeNotePage.tsx
git commit -m "feat(scribe): pass noteType and verbosity to FocusedAIPanel"
```

---

### Task 4: Final verification

**Step 1: Run all backend scribe tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend
node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage 2>&1 | tail -25
```

Expected: all tests PASS

**Step 2: Run all frontend scribe tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI
npx vitest run src/components/scribe-standalone/ 2>&1 | tail -25
```

Expected: all tests PASS

**Step 3: Push to GitHub**

```bash
cd /Users/bitbox/Documents/DocAssistAI
git push origin main
```
