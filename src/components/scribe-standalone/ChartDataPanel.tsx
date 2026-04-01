import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BarChart3, FileText, Send, X } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

type Mode = 'add_to_note' | 'graph_values';

export interface SectionOption {
  id: string;
  section_name: string;
}

interface Props {
  noteType: string;
  verbosity: string;
  sections: SectionOption[];
  onGraphResult: (svg: string) => void;
  onApplyText: (sectionId: string, text: string) => void;
}

export const ChartDataPanel: React.FC<Props> = ({ noteType, verbosity, sections, onGraphResult, onApplyText }) => {
  const [collapsed, setCollapsed] = useState(true);
  const [mode, setMode] = useState<Mode>('graph_values');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Holds AI-processed text while the user picks a destination section
  const [pendingText, setPendingText] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!pasteText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (mode === 'graph_values') {
        const res = await fetch(`${getBackendUrl()}/api/ai/scribe/chart-to-graph`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ chartData: pasteText, noteType, verbosity }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.svg) {
          onGraphResult(data.svg);
          setPasteText('');
          setCollapsed(true);
        }
      } else {
        // "Add to Note" mode — use the chat endpoint
        const res = await fetch(`${getBackendUrl()}/api/ai/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `Integrate the following chart data into clinical note text suitable for a ${noteType.replace(/_/g, ' ')}. Write concise, physician-voice documentation.\n\nChart data:\n${pasteText}`,
              },
            ],
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const content = data.data?.content || data.content || '';
        if (content) {
          setPendingText(content);
          setPasteText('');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionPick = (sectionId: string) => {
    if (pendingText) {
      onApplyText(sectionId, pendingText);
      setPendingText(null);
      setCollapsed(true);
    }
  };

  const handleCancelPick = () => {
    setPendingText(null);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-teal-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chart Data</span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Section picker — shown after AI processes text */}
          {pendingText ? (
            <div className="space-y-3">
              <div className="bg-slate-900 border border-teal-400/30 rounded-lg p-3">
                <p className="text-xs font-medium text-teal-400 mb-2">Which section should this be added to?</p>
                <p className="text-xs text-slate-400 mb-3 line-clamp-3">{pendingText}</p>
                <div className="flex flex-wrap gap-2">
                  {sections.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSectionPick(s.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-slate-200 border border-slate-600 hover:bg-teal-400/20 hover:text-teal-400 hover:border-teal-400/30 transition-colors"
                    >
                      {s.section_name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelPick}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={12} />
                Cancel
              </button>
            </div>
          ) : (
            <>
              {/* Mode selector */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('graph_values')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === 'graph_values'
                      ? 'bg-teal-400/20 text-teal-400 border border-teal-400/30'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-300'
                  }`}
                >
                  <BarChart3 size={12} />
                  Graph Values
                </button>
                <button
                  type="button"
                  onClick={() => setMode('add_to_note')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mode === 'add_to_note'
                      ? 'bg-teal-400/20 text-teal-400 border border-teal-400/30'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-300'
                  }`}
                >
                  <FileText size={12} />
                  Add to Note
                </button>
              </div>

              {/* Textarea */}
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={
                  mode === 'graph_values'
                    ? 'Paste numerical data here (labs, vitals, trending values...)'
                    : 'Paste chart data here (labs, meds, imaging results...)'
                }
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y"
              />

              {/* Error */}
              {error && (
                <p className="text-xs text-red-400">{error}</p>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !pasteText.trim()}
                className="flex items-center justify-center gap-2 w-full bg-teal-400 text-slate-900 rounded-lg py-2 text-sm font-semibold hover:bg-teal-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full" />
                    {mode === 'graph_values' ? 'Generating graph…' : 'Processing…'}
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    {mode === 'graph_values' ? 'Generate Graph' : 'Process & Add to Note'}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChartDataPanel;
