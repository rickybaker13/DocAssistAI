import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NoteCard } from './NoteCard';
import { getBackendUrl } from '../../config/appConfig';
import type { Note } from './types';

const STATUS_FILTERS = ['All', 'Draft', 'Finalized'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

export const ScribeDashboardPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/notes`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setNotes(d.notes || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const r = await fetch(`${getBackendUrl()}/api/scribe/notes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (e: unknown) {
      // Note remains in list if delete failed — user can try again
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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Notes</h1>
        <Link
          to="/scribe/note/new"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Note
        </Link>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by patient label or note type..."
        aria-label="Search notes"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="flex gap-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          {notes.length === 0 ? (
            <>
              <p className="text-gray-400 text-base mb-2">No notes yet</p>
              <p className="text-gray-300 text-sm mb-4">Record your first patient encounter to get started</p>
              <Link to="/scribe/note/new" className="text-blue-600 hover:underline text-sm">Create first note →</Link>
            </>
          ) : (
            <p className="text-gray-400 text-sm">No notes match your search</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};
