import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, X, ClipboardCopy, Check, Trash2 } from 'lucide-react';
import { NoteSectionEditor } from './NoteSectionEditor';
import { FocusedAIPanel } from './FocusedAIPanel';
import { ScribeChatDrawer } from './ScribeChatDrawer';
import { getBackendUrl } from '../../config/appConfig';
import { localNoteStore, type LocalNote, type LocalSection } from '../../lib/localNoteStore';

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

type CopyState = 'idle' | 'copied';

export const ScribeNotePage: React.FC = () => {
  const { id: noteId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<LocalNote | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusedSection, setFocusedSection] = useState<SectionData | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (!noteId) { setLoading(false); return; }
    const stored = localNoteStore.get(noteId);
    if (!stored) {
      setError('Note not found');
      setLoading(false);
      return;
    }
    setNote(stored);
    setSections(stored.sections);
    const initial: Record<string, string> = {};
    stored.sections.forEach((s: LocalSection) => { initial[s.id] = s.content || ''; });
    setEdits(initial);
    setLoading(false);
  }, [noteId]);

  const handleSectionChange = useCallback((id: string, content: string) => {
    setEdits(prev => ({ ...prev, [id]: content }));
  }, []);

  // UI-only: removes section from local display state.
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

  /** Merge current edits into stored sections, then copy full note to clipboard. */
  const handleCopyForEmr = () => {
    if (!noteId) return;

    // Persist current edits to localStorage before copying
    const mergedSections: LocalSection[] = sections.map(s => ({
      ...s,
      content: edits[s.id] ?? s.content,
    }));
    localNoteStore.update(noteId, { sections: mergedSections });

    const fullNote = sections
      .map(s => `${s.section_name.toUpperCase()}\n${edits[s.id] ?? s.content ?? ''}`)
      .join('\n\n');

    navigator.clipboard.writeText(fullNote).catch(() => {
      // Clipboard may fail in some browser contexts — silent fail, state still advances
    });
    setCopyState('copied');
  };

  const handleDeleteNote = () => {
    if (!noteId) return;
    localNoteStore.delete(noteId);
    navigate('/scribe/dashboard');
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
    </div>
  );

  if (!note) return <div className="text-red-500 p-4">Note not found.</div>;

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
              {note.patient_label || note.note_type.replace(/_/g, ' ')}
            </h1>
            <span className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2.5 py-1 rounded-lg">
              {note.note_type.replace(/_/g, ' ')}
            </span>
            <span className={
              note.status === 'finalized'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full'
                : 'bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2.5 py-1 rounded-full'
            }>
              {note.status}
            </span>
          </div>
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

      {/* Copy for EMR → Done/Delete flow */}
      {copyState === 'idle' ? (
        <button
          onClick={handleCopyForEmr}
          className="w-full py-3 bg-teal-400 text-slate-900 rounded-xl font-semibold text-base hover:bg-teal-300 transition-colors flex items-center justify-center gap-2"
        >
          <ClipboardCopy size={18} aria-hidden="true" />
          Copy for EMR
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="w-full py-3 bg-emerald-950 border border-emerald-400/30 text-emerald-400 rounded-xl font-semibold text-base flex items-center justify-center gap-2">
            <Check size={18} aria-hidden="true" />
            Copied — paste into your EMR
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteNote}
              className="flex-1 py-2.5 bg-red-950 border border-red-400/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-900 transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 size={15} aria-hidden="true" />
              Done — Delete Note
            </button>
            <button
              onClick={() => setCopyState('idle')}
              className="flex-1 py-2.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors"
            >
              Not yet
            </button>
          </div>
        </div>
      )}

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
      <ScribeChatDrawer
        sections={sections}
        noteType={note.note_type}
        verbosity={note.verbosity}
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
