import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteSectionEditor } from './NoteSectionEditor';
import { FocusedAIPanel } from './FocusedAIPanel';
import { ScribeChatDrawer } from './ScribeChatDrawer';
import { getBackendUrl } from '../../config/appConfig';

interface NoteData {
  id: string;
  note_type: string;
  patient_label: string | null;
  status: string;
  transcript: string | null;
}

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
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) && !existingSectionNames.has(t.name)
  );

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-gray-200">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..."
          aria-label="Search sections"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {filtered.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 })}
          className="w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-blue-50 transition-colors"
        >
          {t.name}
        </button>
      ))}
      {filtered.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">No sections found</p>
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
  const [note, setNote] = useState<NoteData | null>(null);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedSection, setFocusedSection] = useState<SectionData | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => {
    if (!noteId) { setLoading(false); return; }
    fetch(`${getBackendUrl()}/api/scribe/notes/${noteId}`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load note (${r.status})`);
        return r.json();
      })
      .then(d => {
        setNote(d.note);
        setSections(d.sections || []);
        const initial: Record<string, string> = {};
        (d.sections || []).forEach((s: SectionData) => { initial[s.id] = s.content || ''; });
        setEdits(initial);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load note');
        setLoading(false);
      });
  }, [noteId]);

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
    setFocusedSection(null);
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

  const handleFinalize = async () => {
    if (!noteId) return;
    setSaving(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'finalized' }),
      });
      if (!res.ok) throw new Error('Failed to finalize note');
      navigate('/scribe/dashboard');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to finalize');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!note) return <div className="text-red-500 p-4">Note not found.</div>;

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="text-red-500 p-4 bg-red-50 rounded-lg text-sm">{error}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            {note.patient_label || note.note_type.replace(/_/g, ' ')}
          </h1>
          <span className={`text-xs px-2 py-0.5 rounded-full ${note.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {note.status}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="text-sm px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Finalize'}
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
        className="text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors w-full"
      >
        + Add Section
      </button>

      <button
        onClick={handleCopyNote}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 transition-colors"
      >
        Copy Note
      </button>

      {focusedSection && (
        <FocusedAIPanel
          section={focusedSection}
          transcript={note.transcript || ''}
          onClose={() => setFocusedSection(null)}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
      <ScribeChatDrawer
        sections={sections}
        noteType={note.note_type}
        onInsert={handleChatInsert}
      />

      {showAddSection && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '60vh' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-sm">Add Section</h3>
            <button onClick={() => setShowAddSection(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
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
