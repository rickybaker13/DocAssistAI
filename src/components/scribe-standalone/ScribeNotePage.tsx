import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { NoteSectionEditor } from './NoteSectionEditor';
import { FocusedAIPanel } from './FocusedAIPanel';
import { ScribeChatDrawer } from './ScribeChatDrawer';
import { useScribeNoteStore, type NoteSection } from '../../stores/scribeNoteStore';
import { getBackendUrl } from '../../config/appConfig';

interface SectionData {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

// ---------------------------------------------------------------------------
// SectionLibraryForNote — inline component for the add-section drawer
// ---------------------------------------------------------------------------

interface SectionLibraryForNoteProps {
  onSelect: (t: { id: string; name: string; promptHint: string | null; isPrebuilt: boolean }) => void;
  existingSectionNames: Set<string>;
}

const SectionLibraryForNote: React.FC<SectionLibraryForNoteProps> = ({ onSelect, existingSectionNames }) => {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; prompt_hint: string | null; is_prebuilt: number }>>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/templates`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setTemplates(d.templates || []))
      .catch(() => { /* template list is non-critical; section library will show empty */ });
  }, []);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) && !existingSectionNames.has(t.name)
  );

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-slate-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..."
          aria-label="Search sections"
          className="w-full border border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-slate-900 text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      {filtered.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 })}
          className="w-full text-left px-3 py-2.5 text-sm border-b border-slate-700 text-slate-200 hover:bg-teal-400/10 transition-colors"
        >
          {t.name}
        </button>
      ))}
      {filtered.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-4">No sections found</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ScribeNotePage
// ---------------------------------------------------------------------------

export const ScribeNotePage: React.FC = () => {
  const { id: noteId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Read note data from client-side Zustand store — no server fetch
  const storeNote = useScribeNoteStore();
  const storeSections = storeNote.sections;

  const [sections, setSections] = useState<SectionData[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedSection, setFocusedSection] = useState<SectionData | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  // Initialise local editing state from the Zustand store
  useEffect(() => {
    if (!noteId || storeNote.noteId !== noteId) {
      setError(storeNote.noteId ? 'Note ID mismatch' : 'No active note');
      setLoading(false);
      return;
    }
    setSections(storeSections);
    const initial: Record<string, string> = {};
    storeSections.forEach((s: NoteSection) => { initial[s.id] = s.content || ''; });
    setEdits(initial);
    setLoading(false);
  }, [noteId, storeNote.noteId, storeSections]);

  const handleSectionChange = useCallback((id: string, content: string) => {
    setEdits(prev => ({ ...prev, [id]: content }));
  }, []);

  const handleDeleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
    setEdits(prev => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  };

  const handleAddSectionFromLibrary = (template: { id: string; name: string; promptHint: string | null; isPrebuilt: boolean }) => {
    const newSection: SectionData = {
      id: `local-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      section_name: template.name,
      content: null,
      confidence: null,
      display_order: sections.length,
    };
    setSections(prev => [...prev, newSection]);
    setEdits(prev => ({ ...prev, [newSection.id]: '' }));
    setShowAddSection(false);
  };

  const handleApplySuggestion = (sectionId: string, suggestion: string) => {
    setEdits(prev => ({
      ...prev,
      [sectionId]: (prev[sectionId] ? prev[sectionId] + '\n' : '') + suggestion,
    }));
  };

  const handleChatInsert = (sectionId: string, text: string) => {
    setEdits(prev => ({
      ...prev,
      [sectionId]: (prev[sectionId] ? prev[sectionId] + '\n' : '') + text,
    }));
  };

  const handleCopyNote = () => {
    const fullNote = sections
      .map(s => `${s.section_name.toUpperCase()}\n${edits[s.id] || s.content || ''}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullNote);
  };

  const handleFinalize = () => {
    // Client-side only — no server call
    storeNote.setStatus('finalized');
    navigate('/scribe/dashboard');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
    </div>
  );

  if (!storeNote.noteId) return <div className="text-red-500 p-4">Note not found.</div>;

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="text-red-400 p-4 bg-red-950 rounded-lg text-sm border border-red-400/30">{error}</div>}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors w-fit"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-slate-50 font-semibold text-lg">
              {storeNote.patientLabel || storeNote.noteType.replace(/_/g, ' ')}
            </h1>
            <span className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-lg">
              {storeNote.noteType.replace(/_/g, ' ')}
            </span>
            <span className={
              storeNote.status === 'finalized'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full'
                : 'bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2.5 py-1 rounded-full'
            }>
              {storeNote.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFinalize}
            className="bg-teal-400 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-teal-300 transition-colors"
          >
            Finalize
          </button>
        </div>
      </div>

      {sections.map(section => (
        <NoteSectionEditor
          key={section.id}
          section={{ ...section, content: edits[section.id] ?? section.content }}
          onChange={handleSectionChange}
          onFocusedAI={setFocusedSection}
          onDelete={() => handleDeleteSection(section.id)}
        />
      ))}

      <button
        onClick={() => setShowAddSection(true)}
        className="text-sm text-teal-400 border border-dashed border-slate-700 rounded-lg px-4 py-2 hover:bg-teal-400/10 transition-colors w-full"
      >
        + Add Section
      </button>

      <button
        onClick={handleCopyNote}
        className="w-full py-3 bg-teal-400 text-slate-900 rounded-xl font-semibold text-base hover:bg-teal-300 transition-colors"
      >
        Copy Note
      </button>

      {focusedSection && (
        <FocusedAIPanel
          section={focusedSection}
          transcript={storeNote.transcript || ''}
          noteType={storeNote.noteType}
          verbosity={storeNote.verbosity}
          onClose={() => setFocusedSection(null)}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
      <ScribeChatDrawer
        sections={sections}
        noteType={storeNote.noteType}
        verbosity={storeNote.verbosity}
        onInsert={handleChatInsert}
      />

      {showAddSection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-section-heading"
          className="fixed inset-x-0 bottom-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl"
          style={{ maxHeight: '60vh' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h3 id="add-section-heading" className="font-semibold text-slate-50 text-sm">Add Section</h3>
            <button
              type="button"
              onClick={() => setShowAddSection(false)}
              aria-label="Close add section panel"
              className="text-slate-400 hover:text-slate-200"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 52px)' }}>
            <SectionLibraryForNote
              onSelect={handleAddSectionFromLibrary}
              existingSectionNames={new Set(sections.map(s => s.section_name))}
            />
          </div>
        </div>
      )}
    </div>
  );
};
