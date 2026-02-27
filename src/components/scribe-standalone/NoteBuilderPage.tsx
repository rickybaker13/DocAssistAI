// src/components/scribe-standalone/NoteBuilderPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, X } from 'lucide-react';
import { SectionLibrary } from './SectionLibrary';
import { NoteCanvas } from './NoteCanvas';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { useNoteTemplates, NoteTemplate } from '../../hooks/useNoteTemplates';
import { useScribeNoteStore, generateNoteId } from '../../stores/scribeNoteStore';
import { getBackendUrl } from '../../config/appConfig';

const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
];

type Verbosity = 'brief' | 'standard' | 'detailed';

const VERBOSITY_OPTIONS: { value: Verbosity; label: string; description: string }[] = [
  { value: 'brief', label: 'Brief', description: 'Bullet points, concise' },
  { value: 'standard', label: 'Standard', description: 'Balanced clinical prose' },
  { value: 'detailed', label: 'Detailed', description: 'Full prose, all detail' },
];

export const NoteBuilderPage: React.FC = () => {
  const {
    canvasSections, noteType, patientLabel, verbosity, selectedTemplateId,
    setNoteType, setPatientLabel, clearCanvas, setVerbosity, setSelectedTemplate,
  } = useScribeBuilderStore();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { systemTemplates, userTemplates, loading: templatesLoading, deleteTemplate, saveTemplate } = useNoteTemplates(noteType);

  const handleSelectTemplate = (tmpl: NoteTemplate) => {
    const sections = (JSON.parse(tmpl.sections) as Array<{ name: string; promptHint: string | null }>).map((s, i) => ({
      canvasId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
      templateId: `tmpl-${tmpl.id}-${i}`,
      name: s.name,
      promptHint: s.promptHint,
      isPrebuilt: tmpl.user_id === null,
    }));
    setSelectedTemplate(tmpl.id, sections);
    setVerbosity(tmpl.verbosity as Verbosity);
  };

  const { initNote } = useScribeNoteStore();

  const handleStartRecording = () => {
    if (canvasSections.length === 0) { setError('Add at least one section before recording'); return; }
    setError(null);
    // Client-side only — no server call. Generate a local ID and init the store.
    const noteId = generateNoteId();
    initNote({ noteId, noteType, patientLabel: patientLabel || '', verbosity });
    navigate(`/scribe/note/${noteId}/record`);
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) { setSaveError('Template name is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const sections = canvasSections.map(s => ({ name: s.name, promptHint: s.promptHint }));
      await saveTemplate(saveTemplateName.trim(), verbosity, sections);
      setSaveTemplateName('');
      setShowSaveInput(false);
    } catch {
      setSaveError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-50">New Note</h1>
        <button onClick={() => navigate('/scribe/dashboard')} className="text-sm text-slate-400 hover:text-slate-200">Cancel</button>
      </div>

      {/* Note type + patient label */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={noteType}
          onChange={e => { setNoteType(e.target.value); clearCanvas(); }}
          aria-label="Note type"
          className="bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
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
        {userTemplates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">My Templates</p>
            <div className="flex flex-wrap gap-2">
              {userTemplates.map(tmpl => (
                <div key={tmpl.id} className="flex items-center gap-1">
                  <button onClick={() => handleSelectTemplate(tmpl)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-teal-950 border-teal-400 text-teal-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                    {tmpl.name}
                  </button>
                  <button onClick={() => deleteTemplate(tmpl.id)} aria-label={`Delete ${tmpl.name}`}
                    className="text-slate-600 hover:text-red-400 text-xs px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {templatesLoading && <p className="text-xs text-slate-400">Loading templates...</p>}
      </div>

      {/* Section builder */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={`${showLibrary ? 'block' : 'hidden'} lg:block bg-slate-900 border border-slate-700 rounded-xl overflow-hidden`} style={{ maxHeight: '60vh' }}>
          <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-50">Section Library</h2>
            <button onClick={() => setShowLibrary(false)} aria-label="Close section library" className="lg:hidden text-slate-400">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <SectionLibrary />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-50">Note Sections ({canvasSections.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowLibrary(true)} className="lg:hidden text-sm text-teal-400 border border-teal-400/30 rounded-lg px-3 py-1 hover:bg-teal-950">
                + Add sections
              </button>
              {canvasSections.length > 0 && (
                <button onClick={clearCanvas} className="text-xs text-slate-400 hover:text-red-400">Clear all</button>
              )}
            </div>
          </div>
          <NoteCanvas />
        </div>
      </div>

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

      {/* Save as template */}
      {canvasSections.length > 0 && (
        <div>
          {!showSaveInput ? (
            <button onClick={() => setShowSaveInput(true)} className="text-xs text-teal-400 hover:underline">
              + Save current sections as template
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              />
              <button onClick={handleSaveTemplate} disabled={saving}
                className="px-3 py-1.5 bg-teal-400 text-slate-900 font-semibold rounded-lg text-sm hover:bg-teal-300 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setShowSaveInput(false); setSaveTemplateName(''); }}
                className="text-sm text-slate-400 hover:text-slate-200">Cancel</button>
            </div>
          )}
          {saveError && <p className="text-xs text-red-400 mt-1">{saveError}</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-400 bg-red-950/30 rounded p-2">{error}</p>}
      <button onClick={handleStartRecording} disabled={canvasSections.length === 0}
        className="w-full py-4 bg-teal-400 text-slate-900 rounded-xl font-semibold text-base hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        <Mic size={18} aria-hidden="true" />
        Record
      </button>
    </div>
  );
};
