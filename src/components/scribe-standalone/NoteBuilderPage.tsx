// src/components/scribe-standalone/NoteBuilderPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionLibrary } from './SectionLibrary';
import { NoteCanvas } from './NoteCanvas';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { useNoteTemplates, NoteTemplate } from '../../hooks/useNoteTemplates';
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
  const [creating, setCreating] = useState(false);
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

  const handleStartRecording = async () => {
    if (canvasSections.length === 0) { setError('Add at least one section before recording'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteType, patientLabel: patientLabel || null, verbosity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create note');
      navigate(`/scribe/note/${data.note.id}/record`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    } finally {
      setCreating(false);
    }
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
        <h1 className="text-xl font-bold text-gray-900">New Note</h1>
        <button onClick={() => navigate('/scribe/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      {/* Note type + patient label */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={noteType}
          onChange={e => { setNoteType(e.target.value); clearCanvas(); }}
          aria-label="Note type"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="text" value={patientLabel} onChange={e => setPatientLabel(e.target.value)}
          placeholder="Patient label (optional)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Template selection */}
      <div className="flex flex-col gap-2">
        {systemTemplates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Standard Templates</p>
            <div className="flex flex-wrap gap-2">
              {systemTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {userTemplates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">My Templates</p>
            <div className="flex flex-wrap gap-2">
              {userTemplates.map(tmpl => (
                <div key={tmpl.id} className="flex items-center gap-1">
                  <button onClick={() => handleSelectTemplate(tmpl)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {tmpl.name}
                  </button>
                  <button onClick={() => deleteTemplate(tmpl.id)} aria-label={`Delete ${tmpl.name}`}
                    className="text-gray-300 hover:text-red-400 text-xs px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {templatesLoading && <p className="text-xs text-gray-400">Loading templates...</p>}
      </div>

      {/* Section builder */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={`${showLibrary ? 'block' : 'hidden'} lg:block bg-white border border-gray-200 rounded-xl overflow-hidden`} style={{ maxHeight: '60vh' }}>
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Section Library</h2>
            <button onClick={() => setShowLibrary(false)} className="lg:hidden text-gray-400 text-lg">×</button>
          </div>
          <SectionLibrary />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Note Sections ({canvasSections.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowLibrary(true)} className="lg:hidden text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50">
                + Add sections
              </button>
              {canvasSections.length > 0 && (
                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-400">Clear all</button>
              )}
            </div>
          </div>
          <NoteCanvas />
        </div>
      </div>

      {/* Verbosity */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note Verbosity</p>
        <div className="flex gap-2">
          {VERBOSITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setVerbosity(opt.value)}
              title={opt.description}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${verbosity === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save as template */}
      {canvasSections.length > 0 && (
        <div>
          {!showSaveInput ? (
            <button onClick={() => setShowSaveInput(true)} className="text-xs text-blue-600 hover:underline">
              + Save current sections as template
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              />
              <button onClick={handleSaveTemplate} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setShowSaveInput(false); setSaveTemplateName(''); }}
                className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
          {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
      <button onClick={handleStartRecording} disabled={creating || canvasSections.length === 0}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {creating ? 'Starting...' : '🎙 Record'}
      </button>
    </div>
  );
};
