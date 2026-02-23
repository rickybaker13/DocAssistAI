/**
 * Clinical Notes Viewer
 * Displays clinical notes in EHR-like format with search and filtering
 * Simulates Cerner PowerChart note viewing experience
 */

import { useState, useEffect, useMemo } from 'react';
import { comprehensiveResourceFetcher } from '../../services/fhir/comprehensiveResourceFetcher';
import { noteContentExtractor, ExtractedNote } from '../../services/fhir/noteContentExtractor';
import { usePatientStore } from '../../stores/patientStore';
import LoadingSpinner from '../common/LoadingSpinner';
import PDFViewer from './PDFViewer';

export default function ClinicalNotesViewer() {
  const { patientSummary } = usePatientStore();
  const [notes, setNotes] = useState<ExtractedNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<ExtractedNote | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'type' | 'author'>('date-desc');

  const patientId = patientSummary?.patient?.id;

  useEffect(() => {
    if (patientId) {
      loadNotes();
    }
  }, [patientId]);

  const loadNotes = async () => {
    if (!patientId) return;

    setIsLoading(true);
    setError(null);
    try {
      // Fetch all resources
      const resources = await comprehensiveResourceFetcher.fetchAllResources(patientId);
      
      // Get DocumentReference resources
      const docRefs = resources.resources['DocumentReference']?.resources || [];
      
      if (docRefs.length === 0) {
        setError('No clinical notes found for this patient');
        setIsLoading(false);
        return;
      }

      // Extract note content
      const extractedNotes = await noteContentExtractor.extractAllNotes(docRefs);
      
      setNotes(extractedNotes);
      
      // Auto-select first note
      if (extractedNotes.length > 0) {
        setSelectedNote(extractedNotes[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load clinical notes');
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique note types and authors for filters
  const noteTypes = useMemo(() => {
    const types = new Set(notes.map(n => n.type));
    return Array.from(types).sort();
  }, [notes]);

  const authors = useMemo(() => {
    const auths = new Set(notes.map(n => n.author));
    return Array.from(auths).sort();
  }, [notes]);

  // Filter and sort notes
  const filteredAndSortedNotes = useMemo(() => {
    let filtered = notes;

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.content.toLowerCase().includes(query) ||
        note.title.toLowerCase().includes(query) ||
        note.type.toLowerCase().includes(query) ||
        note.author.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(note => note.type === filterType);
    }

    // Apply author filter
    if (filterAuthor !== 'all') {
      filtered = filtered.filter(note => note.author === filterAuthor);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        case 'author':
          return a.author.localeCompare(b.author);
        default:
          return 0;
      }
    });

    return sorted;
  }, [notes, searchQuery, filterType, filterAuthor, sortBy]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
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
    if (typeLower.includes('progress')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (typeLower.includes('h&p') || typeLower.includes('history')) return 'bg-green-100 text-green-800 border-green-300';
    if (typeLower.includes('discharge')) return 'bg-purple-100 text-purple-800 border-purple-300';
    if (typeLower.includes('icu') || typeLower.includes('accept')) return 'bg-red-100 text-red-800 border-red-300';
    if (typeLower.includes('procedure')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (typeLower.includes('consult')) return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (!patientId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No patient selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingSpinner message="Loading clinical notes..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button
            onClick={loadNotes}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Clinical Notes</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedNotes.length} of {notes.length} notes
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
          <button
            onClick={loadNotes}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search notes content, title, type, author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {noteTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Author Filter */}
          <div>
            <select
              value={filterAuthor}
              onChange={(e) => setFilterAuthor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Authors</option>
              {authors.map(author => (
                <option key={author} value={author}>{author}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sort */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="type">Type</option>
            <option value="author">Author</option>
          </select>
        </div>
      </div>

      <div className="flex h-[600px]">
        {/* Notes List (Left Panel) */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
          {filteredAndSortedNotes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No notes found</p>
              {searchQuery && (
                <p className="text-sm mt-2">Try adjusting your search or filters</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAndSortedNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedNote?.id === note.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getNoteTypeColor(note.type)}`}>
                      {note.type}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(note.date)}</span>
                  </div>
                  <p className="font-medium text-gray-900 text-sm mb-1">{note.title}</p>
                  <p className="text-xs text-gray-600 mb-1">{note.author}</p>
                  {note.content && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {note.content.substring(0, 100)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Note Detail (Right Panel) */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedNote ? (
            <div className="space-y-4">
              {/* Note Header */}
              <div className="border-b border-gray-200 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedNote.title}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded border ${getNoteTypeColor(selectedNote.type)}`}>
                      {selectedNote.type}
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>{formatDate(selectedNote.date)}</p>
                    {selectedNote.status && (
                      <p className="mt-1">
                        Status: <span className="font-medium">{selectedNote.status}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Author:</span> {selectedNote.author}
                  </div>
                  {selectedNote.category.length > 0 && (
                    <div>
                      <span className="font-medium">Category:</span> {selectedNote.category.join(', ')}
                    </div>
                  )}
                  {selectedNote.encounterId && (
                    <div>
                      <span className="font-medium">Encounter:</span> {selectedNote.encounterId}
                    </div>
                  )}
                </div>
              </div>

              {/* Note Content */}
              <div className="prose max-w-none">
                {selectedNote.contentType === 'application/pdf' || selectedNote.sourceUrl?.includes('/Binary/') || selectedNote.pdfDataUrl ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-blue-800 text-sm mb-2">
                        <strong>PDF Document:</strong> This note is stored as a PDF document.
                      </p>
                      {selectedNote.sourceUrl && (
                        <a
                          href={selectedNote.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline text-sm"
                        >
                          Open PDF in new tab →
                        </a>
                      )}
                    </div>
                    {selectedNote.pdfDataUrl ? (
                      <PDFViewer pdfDataUrl={selectedNote.pdfDataUrl} pdfUrl={selectedNote.sourceUrl} />
                    ) : selectedNote.sourceUrl ? (
                      <PDFViewer pdfUrl={selectedNote.sourceUrl} />
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-600">PDF content is being loaded...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded-lg border border-gray-200"
                    dangerouslySetInnerHTML={{ __html: noteContentExtractor.formatNoteForDisplay(selectedNote) }}
                  />
                )}
              </div>

              {/* Raw Data Toggle (for debugging) */}
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                  View Raw DocumentReference Data
                </summary>
                <pre className="mt-2 bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto text-xs max-h-96">
                  {JSON.stringify(selectedNote.rawDocumentReference, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p>Select a note to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

