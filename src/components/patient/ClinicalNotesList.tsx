/**
 * Clinical Notes List Component
 * Displays clinical notes from the patient summary
 */

import { PatientSummary } from '../../types';

interface ClinicalNotesListProps {
  notes: any[];
}

export default function ClinicalNotesList({ notes }: ClinicalNotesListProps) {
  if (!notes || notes.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        <p>No clinical notes available</p>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getNoteTypeColor = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('progress')) return 'bg-blue-100 text-blue-800';
    if (typeLower.includes('h&p') || typeLower.includes('history')) return 'bg-green-100 text-green-800';
    if (typeLower.includes('discharge')) return 'bg-purple-100 text-purple-800';
    if (typeLower.includes('icu') || typeLower.includes('accept')) return 'bg-red-100 text-red-800';
    if (typeLower.includes('procedure')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {notes.map((note, index) => (
        <div
          key={note.id || index}
          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getNoteTypeColor(note.type || '')}`}>
                  {note.type || 'Clinical Note'}
                </span>
                {note.source && (
                  <span className="text-xs text-gray-500">({note.source})</span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">{note.author || 'Unknown Author'}</p>
              <p className="text-xs text-gray-500">{formatDate(note.date)}</p>
            </div>
          </div>
          
          {note.content && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">
                {note.content}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

