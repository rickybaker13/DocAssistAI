import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NoteCard } from './NoteCard';
import { getBackendUrl } from '../../config/appConfig';
import type { Note } from './types';
import { Search, Plus, Settings } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Draft', 'Finalized'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export const ScribeDashboardPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/notes`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setNotes(d.notes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const r = await fetch(`${getBackendUrl()}/api/scribe/notes/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: unknown) {
      console.error('Failed to delete note:', e instanceof Error ? e.message : e);
    }
  };

  const filtered = notes.filter(n => {
    const matchesSearch = !search ||
      (n.patient_label?.toLowerCase().includes(search.toLowerCase())) ||
      n.note_type.replace(/_/g, ' ').includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Draft' && n.status === 'draft') ||
      (statusFilter === 'Finalized' && n.status === 'finalized');
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
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
          <Link
            to="/scribe/note/new"
            className="hidden md:flex items-center gap-1.5 bg-teal-400 text-slate-900 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-300 transition-colors"
          >
            <Plus size={16} />
            New Note
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by patient label or note type…"
          aria-label="Search notes"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
        />
      </div>

      {/* Status filters */}
      <div className="flex gap-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            aria-pressed={statusFilter === f}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === f
                ? 'bg-teal-400/20 text-teal-400 border-teal-400/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div
            role="status"
            aria-label="Loading notes"
            className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full"
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {notes.length === 0 ? (
            <>
              <p className="text-slate-400 text-base mb-2">No notes yet</p>
              <p className="text-slate-400 text-sm mb-4">Record your first patient encounter to get started</p>
              <Link to="/scribe/note/new" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
                Create first note →
              </Link>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No notes match your search</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
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
