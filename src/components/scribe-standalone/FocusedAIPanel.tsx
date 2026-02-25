import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, X, ArrowRight } from 'lucide-react';
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
  | { phase: 'loading'; suggestion: string; sectionId: string; suggestionIndex: number }
  | { phase: 'clarify'; suggestion: string; sectionId: string; question: string; options: string[]; suggestionIndex: number }
  | { phase: 'resolving'; suggestion: string; sectionId: string; selectedOption: string; suggestionIndex: number }
  | { phase: 'preview'; sectionId: string; noteText: string; suggestionIndex: number }
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
  const [showFreeText, setShowFreeText] = useState(false);
  const [freeTextValue, setFreeTextValue] = useState('');
  const [addedSuggestionIndices, setAddedSuggestionIndices] = useState<Set<number>>(new Set());
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const batchQueueRef = useRef<number[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrentItem, setBatchCurrentItem] = useState(0);
  const [addedCitationIndices, setAddedCitationIndices] = useState<Set<number>>(new Set());
  const flowAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => { flowAbortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (!section) return;
    const controller = new AbortController();
    setResult(null);
    setSuggestionFlow(null);
    setLoading(true);
    setError(null);
    setAddedSuggestionIndices(new Set());
    setSelectedSuggestions(new Set());
    setAddedCitationIndices(new Set());
    setBatchCurrentItem(0);
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
      batchQueueRef.current = [];
      setBatchTotal(0);
      setBatchCurrentItem(0);
    }
  }, [section, transcript, noteType, verbosity]);

  const handleToggleSuggestion = useCallback((index: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  // Guard wrapper — used by "Add to note" buttons (prevents concurrent flows)
  const handleAddToNote = useCallback((suggestion: string, index: number) => {
    if (!section || suggestionFlow !== null) return;
    startSuggestionProcessing(suggestion, index);
  }, [section, suggestionFlow, startSuggestionProcessing]);

  const handleSelectAll = useCallback(() => {
    if (!result) return;
    const allUnaddedIndices = result.suggestions
      .map((_, i) => i)
      .filter(i => !addedSuggestionIndices.has(i));
    const allAlreadySelected = allUnaddedIndices.every(i => selectedSuggestions.has(i));
    setSelectedSuggestions(
      allAlreadySelected
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
    setBatchCurrentItem(1);
    setSelectedSuggestions(new Set());
    startSuggestionProcessing(result.suggestions[first], first);
  }, [section, result, selectedSuggestions, addedSuggestionIndices, startSuggestionProcessing]);

  const handleAddCitation = useCallback((c: { guideline: string; year?: string; recommendation: string }, index: number) => {
    if (!section) return;
    const text = `Per ${c.guideline}${c.year ? ` (${c.year})` : ''} guidelines: ${c.recommendation}`;
    onApplySuggestion(section.id, text);
    setAddedCitationIndices(prev => new Set([...prev, index]));
  }, [section, onApplySuggestion]);

  const handleOptionSelected = useCallback(async (option: string) => {
    if (!suggestionFlow || suggestionFlow.phase !== 'clarify') return;
    // Fix 5: Guard against null section
    if (!section) { setSuggestionFlow(null); return; }
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
          destinationSection: section.section_name,
          existingContent: section.content || '',
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

  const handleConfirm = useCallback(() => {
    if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
    onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
    setAddedSuggestionIndices(prev => new Set([...prev, suggestionFlow.suggestionIndex]));

    const nextQueue = [...batchQueueRef.current];
    const nextIndex = nextQueue.shift();
    batchQueueRef.current = nextQueue;

    if (nextIndex !== undefined && result && section) {
      // Auto-advance: start next batch item (transitions preview → loading)
      setBatchCurrentItem(prev => prev + 1);
      startSuggestionProcessing(result.suggestions[nextIndex], nextIndex);
    } else {
      setSuggestionFlow(null);
      // Fix 4: unconditional reset (avoids stale batchTotal closure)
      setBatchTotal(0);
      setBatchCurrentItem(0);
    }
  }, [suggestionFlow, onApplySuggestion, result, section, startSuggestionProcessing, setBatchCurrentItem]);

  const handleFreeTextSubmit = useCallback(() => {
    if (!freeTextValue.trim()) return;
    handleOptionSelected(freeTextValue.trim());
    setShowFreeText(false);
    setFreeTextValue('');
  }, [freeTextValue, handleOptionSelected]);

  if (!section) return null;

  // Derive isAllSelected for aria-label on select-all button
  const allUnaddedIndices = result
    ? result.suggestions.map((_, i) => i).filter(i => !addedSuggestionIndices.has(i))
    : [];
  const isAllSelected =
    allUnaddedIndices.length > 0 &&
    selectedSuggestions.size > 0 &&
    allUnaddedIndices.every(i => selectedSuggestions.has(i));

  return (
    <>
      {/* Main panel */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
        <div
          className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-50 flex items-center gap-2">
                <Sparkles size={15} className="text-teal-400" aria-hidden="true" />
                AI Analysis
              </h2>
              <p className="text-xs text-slate-400">{section.section_name}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-all duration-150"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Fix 1a: role="status" + aria-live on initial loading state */}
            {loading && (
              <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-slate-400">
                <div className="animate-spin h-4 w-4 border-2 border-teal-400 border-t-transparent rounded-full" aria-hidden="true" />
                Analyzing...
              </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {result && (
              <>
                {/* Analysis */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-1">Analysis</h3>
                  <p className="text-sm text-slate-200">{result.analysis}</p>
                </div>

                {/* Citations */}
                {result.citations?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase mb-2">Guideline Citations</h3>
                    {result.citations.map((c, i) => (
                      <div key={i} className="bg-sky-950 border border-sky-400/30 rounded-xl p-3 mb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-sky-400">{c.guideline}{c.year && ` (${c.year})`}</p>
                            <p className="text-slate-200 text-sm mt-0.5">{c.recommendation}</p>
                          </div>
                          {addedCitationIndices.has(i) ? (
                            <span className="text-xs text-emerald-400 font-medium flex-shrink-0 mt-0.5">✓ Added</span>
                          ) : (
                            <button
                              onClick={() => handleAddCitation(c, i)}
                              aria-label="Add citation"
                              className="text-xs text-sky-400 hover:text-sky-300 flex-shrink-0 mt-0.5 transition-colors"
                            >
                              Add citation
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {result.suggestions?.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase">Suggestions</h3>
                      {/* Fix 3: contextual aria-label on select-all button */}
                      <button
                        onClick={handleSelectAll}
                        aria-label={`${isAllSelected ? 'Deselect all' : 'Select all'} suggestions`}
                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        {selectedSuggestions.size > 0 && selectedSuggestions.size === result.suggestions.filter((_, i) => !addedSuggestionIndices.has(i)).length
                          ? 'Deselect all'
                          : 'Select all'}
                      </button>
                    </div>
                    {result.suggestions.map((s, i) => (
                      <div
                        key={i}
                        className={`bg-slate-800 border rounded-xl p-3 mb-2 flex items-center gap-2 text-sm transition-opacity ${
                          addedSuggestionIndices.has(i)
                            ? 'opacity-60 border-emerald-400/30'
                            : 'border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSuggestions.has(i)}
                          onChange={() => handleToggleSuggestion(i)}
                          disabled={addedSuggestionIndices.has(i)}
                          aria-label={`Select suggestion: ${s}`}
                          className="h-3.5 w-3.5 rounded border-slate-600 text-teal-400 flex-shrink-0"
                        />
                        <span className="text-teal-400">•</span>
                        <span className="flex-1 text-slate-200">{s}</span>
                        {addedSuggestionIndices.has(i) ? (
                          <span className="text-xs text-emerald-400 font-medium flex-shrink-0">✓ Added</span>
                        ) : (
                          <button
                            onClick={() => handleAddToNote(s, i)}
                            aria-label="Add to note"
                            className="flex items-center gap-1 text-xs text-teal-400 hover:bg-teal-400/10 px-2 py-1 rounded transition-colors flex-shrink-0"
                          >
                            Add
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedSuggestions.size > 0 && (
                      <button
                        onClick={handleBatchAdd}
                        aria-label={`Add selected (${selectedSuggestions.size})`}
                        className="mt-3 w-full py-2 bg-teal-400 text-slate-900 rounded-xl text-sm font-semibold hover:bg-teal-300 transition-colors"
                      >
                        Add selected ({selectedSuggestions.size}) →
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion flow overlay */}
      {suggestionFlow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          {/* Fix 2: role="dialog", aria-modal="true", aria-label on overlay container */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add to note"
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
          >

            {/* Loading phase */}
            {suggestionFlow.phase === 'loading' && (
              <>
                {/* Fix 1b: role="status" + aria-live on flow loading overlay */}
                <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm text-slate-400">
                  <div className="animate-spin h-5 w-5 border-2 border-teal-400 border-t-transparent rounded-full flex-shrink-0" aria-hidden="true" />
                  <span>
                    {batchTotal > 1
                      ? `Processing ${batchCurrentItem} of ${batchTotal}…`
                      : 'Preparing note text...'}
                  </span>
                </div>
                {batchTotal > 1 && (
                  <div className="h-1.5 bg-slate-700 rounded-full">
                    <div
                      className="h-1.5 bg-teal-400 rounded-full transition-all"
                      style={{ width: `${Math.round((batchCurrentItem / batchTotal) * 100)}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); batchQueueRef.current = []; setBatchTotal(0); setBatchCurrentItem(0); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Clarify phase */}
            {suggestionFlow.phase === 'clarify' && (
              <>
                <p className="text-sm font-semibold text-slate-50">{suggestionFlow.question}</p>

                {!showFreeText ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {suggestionFlow.options.map(opt => (
                        <button
                          key={opt}
                          onClick={() => handleOptionSelected(opt)}
                          className="px-3 py-1.5 rounded-full text-sm text-slate-200 border border-slate-600 hover:border-teal-400 hover:bg-teal-400/10 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                      <button
                        aria-label="Other — enter a custom answer"
                        onClick={() => { setShowFreeText(true); setFreeTextValue(''); }}
                        className="px-3 py-1.5 rounded-full text-sm text-slate-500 border border-dashed border-slate-600 hover:border-teal-400 hover:text-teal-400 transition-colors"
                      >
                        Other…
                      </button>
                    </div>
                    <button
                      onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); batchQueueRef.current = []; setBatchTotal(0); setBatchCurrentItem(0); }}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
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
                        className="flex-1 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-500"
                      />
                      <button
                        onClick={handleFreeTextSubmit}
                        disabled={!freeTextValue.trim()}
                        aria-label="Submit"
                        className="px-3 py-1.5 bg-teal-400 text-slate-900 rounded-lg text-sm font-medium hover:bg-teal-300 disabled:opacity-40 transition-colors"
                      >
                        Submit
                      </button>
                    </div>
                    <button
                      onClick={() => setShowFreeText(false)}
                      aria-label="Back"
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      ← back
                    </button>
                    <button
                      aria-label="Cancel"
                      onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); setShowFreeText(false); batchQueueRef.current = []; setBatchTotal(0); setBatchCurrentItem(0); }}
                      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </>
            )}

            {/* Resolving phase */}
            {suggestionFlow.phase === 'resolving' && (
              <>
                {/* Fix 1b: aria-hidden on spinner in resolving phase */}
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <div className="animate-spin h-5 w-5 border-2 border-teal-400 border-t-transparent rounded-full flex-shrink-0" aria-hidden="true" />
                  <span>Writing note text...</span>
                </div>
                <button
                  onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); batchQueueRef.current = []; setBatchTotal(0); setBatchCurrentItem(0); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* Preview phase */}
            {suggestionFlow.phase === 'preview' && (
              <>
                <p className="text-xs font-semibold text-violet-400 uppercase">Preview</p>
                <div className="bg-violet-950 border border-violet-400/30 rounded-xl p-3">
                  <p className="text-sm text-slate-200">{suggestionFlow.noteText}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    aria-label="Confirm insert into note"
                    className="flex-1 py-2 bg-teal-400 text-slate-900 rounded-xl text-sm font-semibold hover:bg-teal-300 transition-colors"
                  >
                    Confirm ✓
                  </button>
                  <button
                    onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); batchQueueRef.current = []; setBatchTotal(0); setBatchCurrentItem(0); }}
                    aria-label="Cancel"
                    className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 border border-slate-700 rounded-xl transition-colors"
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
