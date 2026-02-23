import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NoteSectionEditor } from './NoteSectionEditor';
import { FocusedAIPanel } from './FocusedAIPanel';
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

  const handleApplySuggestion = (sectionId: string, suggestion: string) => {
    setEdits(prev => ({
      ...prev,
      [sectionId]: (prev[sectionId] ? prev[sectionId] + '\n' : '') + suggestion,
    }));
    setFocusedSection(null);
  };

  const handleCopyAll = () => {
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
            onClick={handleCopyAll}
            className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Copy All
          </button>
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
        />
      ))}

      {focusedSection && (
        <FocusedAIPanel
          section={focusedSection}
          transcript={note.transcript || ''}
          onClose={() => setFocusedSection(null)}
          onApplySuggestion={handleApplySuggestion}
        />
      )}
    </div>
  );
};
