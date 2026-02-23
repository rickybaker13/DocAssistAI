import React, { useEffect, useState } from 'react';
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

interface Props {
  section: Section | null;
  transcript: string;
  onClose: () => void;
  onApplySuggestion: (sectionId: string, suggestion: string) => void;
}

export const FocusedAIPanel: React.FC<Props> = ({ section, transcript, onClose, onApplySuggestion }) => {
  const [result, setResult] = useState<FocusedResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!section) return;
    const controller = new AbortController();
    setResult(null);
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

  if (!section) return null;

  return (
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
                      <p className="font-medium text-blue-800">{c.guideline} {c.year && `(${c.year})`}</p>
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
                        onClick={() => onApplySuggestion(section.id, s)}
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
  );
};
