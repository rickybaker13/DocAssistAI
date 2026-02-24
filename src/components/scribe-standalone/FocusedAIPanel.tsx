import React, { useEffect, useRef, useState, useCallback } from 'react';
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

  const handleConfirm = useCallback(() => {
    if (!suggestionFlow || suggestionFlow.phase !== 'preview') return;
    onApplySuggestion(suggestionFlow.sectionId, suggestionFlow.noteText);
    setAddedSuggestionIndices(prev => new Set([...prev, suggestionFlow.suggestionIndex]));
    setSuggestionFlow(null);
    // onClose() removed; panel stays open for further additions
  }, [suggestionFlow, onApplySuggestion]);

  const handleFreeTextSubmit = useCallback(() => {
    if (!freeTextValue.trim()) return;
    handleOptionSelected(freeTextValue.trim());
    setShowFreeText(false);
    setFreeTextValue('');
  }, [freeTextValue, handleOptionSelected]);

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
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion flow overlay */}
      {suggestionFlow && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">

            {/* Loading phase */}
            {suggestionFlow.phase === 'loading' && (
              <>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                  <span>Preparing note text...</span>
                </div>
                <button
                  onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
            )}

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
                        aria-label="Other — enter a custom answer"
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
                      aria-label="Cancel"
                      onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); setShowFreeText(false); }}
                      className="text-xs text-gray-400 hover:text-gray-600"
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
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full flex-shrink-0" />
                  <span>Writing note text...</span>
                </div>
                <button
                  onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </>
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
                    onClick={() => { flowAbortRef.current?.abort(); setSuggestionFlow(null); }}
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
