/**
 * Note Type Explorer Component
 * Interactive explorer for browsing discovered notes
 */

import { useState, useMemo } from 'react';
import { NormalizedNote } from '../../types';

interface NoteTypeExplorerProps {
  notes: NormalizedNote[];
}

export default function NoteTypeExplorer({ notes }: NoteTypeExplorerProps) {
  const [selectedNote, setSelectedNote] = useState<NormalizedNote | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Get unique note types and providers
  const noteTypes = useMemo(() => {
    return Array.from(new Set(notes.map(n => n.type))).sort();
  }, [notes]);

  const providers = useMemo(() => {
    return Array.from(new Set(notes.map(n => n.author))).sort();
  }, [notes]);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      if (filterType !== 'all' && note.type !== filterType) return false;
      if (filterProvider !== 'all' && note.author !== filterProvider) return false;
      if (searchQuery && !note.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !note.type.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !note.author.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [notes, filterType, filterProvider, searchQuery]);

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Note Explorer</h3>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {noteTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider
            </label>
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Providers</option>
              {providers.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredNotes.length} of {notes.length} notes
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Note List */}
        <div className="border-r border-gray-200 max-h-96 overflow-y-auto">
          {filteredNotes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No notes found matching filters
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedNote?.id === note.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="font-semibold text-gray-900">{note.type}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {note.author} • {new Date(note.date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {note.content.substring(0, 100)}...
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Note Detail */}
        <div className="p-4 max-h-96 overflow-y-auto">
          {selectedNote ? (
            <div>
              <div className="mb-4">
                <h4 className="text-lg font-semibold text-gray-900">{selectedNote.type}</h4>
                <div className="text-sm text-gray-600 mt-1">
                  <p>Author: {selectedNote.author}</p>
                  <p>Date: {new Date(selectedNote.date).toLocaleString()}</p>
                  <p>Source: {selectedNote.source}</p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h5 className="font-semibold text-gray-900 mb-2">Content</h5>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">
                  {selectedNote.content}
                </pre>
              </div>

              {selectedNote.metadata && (
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <h5 className="font-semibold text-gray-900 mb-2">Metadata</h5>
                  <div className="text-sm text-gray-600">
                    {selectedNote.metadata.status && <p>Status: {selectedNote.metadata.status}</p>}
                    {selectedNote.metadata.category && selectedNote.metadata.category.length > 0 && (
                      <p>Categories: {selectedNote.metadata.category.join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-8">
              Select a note to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

