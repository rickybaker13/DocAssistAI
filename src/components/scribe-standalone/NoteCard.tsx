import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { Note } from './types';

interface Props {
  note: Note;
  onDelete: (id: string) => void;
}

function formatNoteType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const NoteCard: React.FC<Props> = ({ note, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={`bg-slate-800 border border-slate-700 border-l-4 ${
      note.status === 'finalized' ? 'border-l-emerald-400' : 'border-l-teal-400'
    } rounded-xl p-4 flex items-start justify-between gap-3 hover:bg-slate-700 hover:border-slate-600 transition-all duration-150`}>
      <Link to={`/scribe/note/${note.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-slate-50 truncate">
            {note.patient_label || formatNoteType(note.note_type)}
          </span>
          {note.status === 'finalized' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-400/30 flex-shrink-0">
              {note.status}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950 text-amber-400 border border-amber-400/30 flex-shrink-0">
              {note.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{formatNoteType(note.note_type)}</span>
          <span>·</span>
          <span>{formatDate(note.created_at)}</span>
        </div>
      </Link>

      <div className="flex-shrink-0">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label={`Delete note${note.patient_label ? ` for ${note.patient_label}` : ''}`}
            className="text-slate-500 hover:text-red-400 hover:bg-slate-600 p-1.5 rounded-lg transition-all duration-150"
          >
            <Trash2 size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-slate-600 transition-all duration-150"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-slate-400 hover:text-slate-300 px-2 py-1 rounded hover:bg-slate-600 transition-all duration-150"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
