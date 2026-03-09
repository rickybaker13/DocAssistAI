import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Settings, FileText, Mic, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';
import { getBackendUrl } from '../../config/appConfig';

interface SavedNote {
  id: string;
  note_type: string;
  patient_label: string;
  verbosity: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const ScribeDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { noteId, noteType, patientLabel, status, encounters, openEncounter, removeEncounter, reset } = useScribeNoteStore();
  const store = useScribeNoteStore();

  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Fetch saved notes from backend on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`${getBackendUrl()}/api/scribe/notes`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { if (!cancelled) setSavedNotes(data.notes || []); })
      .catch(() => { /* non-critical — local encounters still show */ })
      .finally(() => { if (!cancelled) setLoadingNotes(false); });
    return () => { cancelled = true; };
  }, []);

  const handleDiscard = () => {
    reset();
  };

  const handleOpenSavedNote = async (id: string) => {
    // If already loaded locally, just navigate
    if (noteId === id) {
      navigate(`/scribe/note/${id}`);
      return;
    }
    // Check local encounters first
    const localEnc = encounters.find(e => e.noteId === id && e.status === 'ready');
    if (localEnc) {
      openEncounter(id);
      navigate(`/scribe/note/${id}`);
      return;
    }
    // Fetch full note from backend and hydrate the store
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/notes/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { note } = await res.json();
      const sections = (typeof note.sections === 'string' ? JSON.parse(note.sections) : note.sections) || [];
      store.initNote({ noteId: note.id, noteType: note.note_type, patientLabel: note.patient_label, verbosity: note.verbosity });
      store.setTranscript(note.transcript || '');
      store.setSections(sections);
      store.setStatus(note.status === 'finalized' ? 'finalized' : 'draft');
      navigate(`/scribe/note/${id}`);
    } catch {
      // If fetch fails, can't open
    }
  };

  const handleDeleteSavedNote = async (id: string) => {
    setSavedNotes(prev => prev.filter(n => n.id !== id));
    // Also remove from local encounters if present
    removeEncounter(id);
    // If this is the currently-open note, clear it
    if (noteId === id) reset();
    fetch(`${getBackendUrl()}/api/scribe/notes/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
  };

  // Merge: local encounters that are still processing/failed should show above saved notes.
  // Filter out local encounters that already exist in savedNotes to avoid duplicates.
  const savedNoteIds = new Set(savedNotes.map(n => n.id));
  const localOnlyEncounters = encounters.filter(e => !savedNoteIds.has(e.noteId));

  const hasAnything = localOnlyEncounters.length > 0 || savedNotes.length > 0 || noteId;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-50 tracking-tight">My Notes</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/scribe/settings"
            aria-label="Settings"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      <Link
        to="/scribe/note/new"
        className="w-full py-4 bg-teal-400 text-slate-900 rounded-xl font-semibold text-base hover:bg-teal-300 transition-colors flex items-center justify-center gap-2"
      >
        <Mic size={18} aria-hidden="true" />
        Record Next Encounter
      </Link>

      {/* Local-only encounters (processing / failed — not yet saved to backend) */}
      {localOnlyEncounters.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">In Progress</p>
          <div className="flex flex-col gap-2">
            {localOnlyEncounters.map((item) => (
              <div key={item.noteId} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-teal-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-100">{item.patientLabel || item.noteType.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400">{item.noteType.replace(/_/g, ' ')}</p>
                  </div>
                  {item.status === 'processing' && (
                    <span className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-400 border border-blue-400/30 text-xs px-2.5 py-1 rounded-full">
                      <Loader2 size={12} className="animate-spin" />
                      Processing
                    </span>
                  )}
                  {item.status === 'ready' && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={12} />
                      Ready
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span className="inline-flex items-center gap-1.5 bg-red-950 text-red-400 border border-red-400/30 text-xs px-2.5 py-1 rounded-full">
                      <AlertCircle size={12} />
                      Failed
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {item.status === 'ready' ? (
                    <Link
                      to={`/scribe/note/${item.noteId}`}
                      onClick={() => { openEncounter(item.noteId); }}
                      className="px-3 py-1.5 bg-teal-400 text-slate-900 font-semibold rounded-lg text-sm hover:bg-teal-300 transition-colors"
                    >
                      Open
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="px-3 py-1.5 border border-slate-700 text-slate-500 rounded-lg text-sm cursor-not-allowed"
                    >
                      Open
                    </button>
                  )}
                  <button
                    onClick={() => removeEncounter(item.noteId)}
                    className="px-3 py-1.5 border border-slate-600 text-slate-400 rounded-lg text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Notes from backend — available on any device */}
      {savedNotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saved Notes</p>
          <div className="flex flex-col gap-2">
            {savedNotes.map((note) => (
              <div key={note.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-teal-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-100">{note.patient_label || note.note_type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-400">{note.note_type.replace(/_/g, ' ')}</p>
                  </div>
                  <span className={
                    note.status === 'finalized'
                      ? 'inline-flex items-center gap-1.5 bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full'
                      : 'inline-flex items-center gap-1.5 bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2.5 py-1 rounded-full'
                  }>
                    {note.status === 'finalized' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                    {note.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenSavedNote(note.id)}
                    className="px-3 py-1.5 bg-teal-400 text-slate-900 font-semibold rounded-lg text-sm hover:bg-teal-300 transition-colors"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleDeleteSavedNote(note.id)}
                    className="px-3 py-1.5 border border-slate-600 text-slate-400 rounded-lg text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingNotes && savedNotes.length === 0 && encounters.length === 0 && !noteId && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      )}

      {!loadingNotes && !hasAnything && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-base mb-2">No notes yet</p>
          <p className="text-slate-400 text-sm mb-4">Record your first patient encounter to get started</p>
          <Link to="/scribe/note/new" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
            Create first note →
          </Link>
        </div>
      )}

      <Link
        to="/scribe/note/new"
        aria-label="New Note"
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-teal-400 text-slate-900 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center hover:bg-teal-300 transition-all duration-150"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
};
