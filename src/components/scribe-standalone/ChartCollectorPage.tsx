import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardPaste, X, FileText, Trash2 } from 'lucide-react';
import { useChartCollectorStore, FRAGMENT_LABELS, FragmentLabel } from '../../stores/chartCollectorStore';
import { useNoteTemplates, NoteTemplate } from '../../hooks/useNoteTemplates';
import { useScribeNoteStore, generateNoteId } from '../../stores/scribeNoteStore';
import { useTemplatePreferences } from '../../hooks/useTemplatePreferences';
import { buildCanvasSectionsFromTemplate } from '../../utils/noteTemplateUtils';
import { getBackendUrl } from '../../config/appConfig';

const NOTE_TYPES = [
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'procedure_note', label: 'Procedure Note' },
];

type Verbosity = 'concise' | 'brief' | 'standard' | 'detailed';

const VERBOSITY_OPTIONS: { value: Verbosity; label: string; description: string }[] = [
  { value: 'concise', label: 'Concise', description: 'Telegraphic, key facts only' },
  { value: 'brief', label: 'Brief', description: 'Bullet points, concise' },
  { value: 'standard', label: 'Standard', description: 'Balanced clinical prose' },
  { value: 'detailed', label: 'Detailed', description: 'Full prose, all detail' },
];

export const ChartCollectorPage: React.FC = () => {
  const {
    fragments, noteType, patientLabel, verbosity,
    addFragment, removeFragment, updateFragmentLabel,
    setNoteType, setPatientLabel, setVerbosity, clearAll,
  } = useChartCollectorStore();
  const navigate = useNavigate();

  const [pasteText, setPasteText] = useState('');
  const [pasteLabel, setPasteLabel] = useState<FragmentLabel>('Other');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Template selection
  const { systemTemplates, userTemplates, loading: templatesLoading } = useNoteTemplates(noteType);
  const { frequentTemplateIds, maxFrequentTemplates } = useTemplatePreferences();
  const frequentTemplates = userTemplates.filter(t => frequentTemplateIds.includes(t.id)).slice(0, maxFrequentTemplates);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<Array<{ name: string; promptHint: string | null }>>([]);

  const { enqueueEncounter, completeEncounter, failEncounter } = useScribeNoteStore();

  const handleSelectTemplate = (tmpl: NoteTemplate) => {
    setSelectedTemplateId(tmpl.id);
    const sections = buildCanvasSectionsFromTemplate(tmpl);
    setSelectedSections(sections.map(s => ({ name: s.name, promptHint: s.promptHint })));
    setVerbosity(tmpl.verbosity as Verbosity);
  };

  const handleAddFragment = () => {
    if (!pasteText.trim()) return;
    addFragment(pasteText.trim(), pasteLabel);
    setPasteText('');
  };

  const handleGenerate = async () => {
    if (fragments.length === 0) { setError('Add at least one chart fragment'); return; }
    if (selectedSections.length === 0) { setError('Select a template first'); return; }
    setError(null);
    setGenerating(true);

    const noteId = generateNoteId();
    const combinedText = fragments.map(f => `--- ${f.label.toUpperCase()} ---\n${f.text}`).join('\n\n');

    enqueueEncounter({ noteId, noteType, patientLabel: patientLabel || '', verbosity, transcript: combinedText });
    navigate('/scribe/dashboard');

    void (async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/ai/scribe/chart-generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            fragments: fragments.map(f => ({ label: f.label, text: f.text })),
            sections: selectedSections,
            noteType,
            verbosity,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as any).error || `Chart generation failed (${res.status})`);
        }
        const data = await res.json();
        const sections = (data.sections || []).map((s: any, i: number) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
          section_name: s.name,
          content: s.content || null,
          confidence: s.confidence ?? null,
          display_order: i,
        }));
        completeEncounter(noteId, sections);
        clearAll();
      } catch (e: unknown) {
        let msg = 'An unexpected error occurred';
        if (e instanceof TypeError) msg = 'Unable to reach server. Check your connection.';
        else if (e instanceof Error) msg = e.message;
        failEncounter(noteId, msg);
      }
    })();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-50">Chart to Note</h1>
        <button onClick={() => navigate('/scribe/dashboard')} className="text-sm text-slate-400 hover:text-slate-200">Cancel</button>
      </div>

      {/* Note type + patient label */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={noteType}
          onChange={e => { setNoteType(e.target.value); setSelectedTemplateId(null); setSelectedSections([]); }}
          aria-label="Note type"
          className="bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="text" value={patientLabel} onChange={e => setPatientLabel(e.target.value)}
          placeholder="Patient label (optional)"
          className="flex-1 bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
      </div>

      {/* Template selection */}
      <div className="flex flex-col gap-2">
        {systemTemplates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Standard Templates</p>
            <div className="flex flex-wrap gap-2">
              {systemTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-teal-950 border-teal-400 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {frequentTemplates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">My Templates (Frequent)</p>
            <div className="flex flex-wrap gap-2">
              {frequentTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-teal-950 border-teal-400 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {templatesLoading && <p className="text-xs text-slate-400">Loading templates...</p>}
      </div>

      {/* Paste zone */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Add Chart Data</p>
        <div className="flex gap-2 items-end">
          <select
            value={pasteLabel}
            onChange={e => setPasteLabel(e.target.value as FragmentLabel)}
            aria-label="Fragment label"
            className="bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {FRAGMENT_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button
            onClick={handleAddFragment}
            disabled={!pasteText.trim()}
            className="px-4 py-2 bg-teal-400 text-slate-900 font-semibold rounded-lg text-sm hover:bg-teal-300 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        </div>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder="Paste chart data here (labs, imaging, med list, etc.)..."
          rows={5}
          className="w-full bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y"
        />
      </div>

      {/* Fragment cards */}
      {fragments.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Chart Fragments ({fragments.length})
            </p>
            <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-400">Clear all</button>
          </div>
          {fragments.map(f => (
            <div key={f.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-start gap-3">
              <FileText size={16} className="text-teal-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <select
                    value={f.label}
                    onChange={e => updateFragmentLabel(f.id, e.target.value as FragmentLabel)}
                    className="bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-0.5 text-xs focus:outline-none"
                  >
                    {FRAGMENT_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <p className="text-xs text-slate-400 line-clamp-3 whitespace-pre-wrap">{f.text}</p>
              </div>
              <button onClick={() => removeFragment(f.id)} className="text-slate-500 hover:text-red-400 shrink-0" aria-label="Remove fragment">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Verbosity */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Note Verbosity</p>
        <div className="bg-slate-800 rounded-full p-1 flex w-fit" role="group" aria-label="Note verbosity">
          {VERBOSITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setVerbosity(opt.value)}
              aria-label={`${opt.label} — ${opt.description}`}
              aria-pressed={verbosity === opt.value}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${verbosity === opt.value ? 'bg-slate-700 text-slate-50' : 'text-slate-500 hover:text-slate-300'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-950/30 rounded p-2">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={fragments.length === 0 || selectedSections.length === 0 || generating}
        className="w-full py-4 bg-teal-400 text-slate-900 rounded-xl font-semibold text-base hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
      >
        <ClipboardPaste size={18} aria-hidden="true" />
        Generate Note from Charts
      </button>
    </div>
  );
};
