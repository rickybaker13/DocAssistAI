import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Note {
  id: string;
  note_type: string;
  patient_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  note: Note;
  onDelete: (id: string) => void;
}

function formatNoteType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const NoteCard: React.FC<Props> = ({ note, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
      <Link to={`/scribe/note/${note.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-gray-900 truncate">
            {note.patient_label || formatNoteType(note.note_type)}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${note.status === 'finalized' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {note.status}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{formatNoteType(note.note_type)}</span>
          <span>·</span>
          <span>{formatDate(note.created_at)}</span>
        </div>
      </Link>

      <div className="flex-shrink-0">
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete note"
            className="text-gray-300 hover:text-red-400 transition-colors p-1"
          >
            🗑
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onDelete(note.id)}
              aria-label="Delete"
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
