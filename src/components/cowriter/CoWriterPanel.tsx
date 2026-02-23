// src/components/cowriter/CoWriterPanel.tsx
import React, { useState } from 'react';

const NOTE_TYPES = [
  'Progress Note', 'H&P', 'Transfer Note', 'Accept Note',
  'Consult Note', 'Discharge Summary', 'Procedure Note',
];

interface NoteSection {
  name: string;
  content: string;
  sources?: string[];
}

interface GeneratedDocument {
  noteType: string;
  sections: NoteSection[];
  generatedAt: string;
}

export const CoWriterPanel: React.FC = () => {
  const [noteType, setNoteType] = useState('Progress Note');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ai/generate-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Patient-Id': sessionStorage.getItem('patientId') || '',
            'X-Session-Id': sessionStorage.getItem('sessionId') || '',
          },
          body: JSON.stringify({ template: noteType, context: additionalContext }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Generation failed');
      }
      const data = await res.json();
      const doc: GeneratedDocument = data.document;
      setGeneratedDoc(doc);
      // Initialize editable sections
      const initial: Record<string, string> = {};
      doc.sections?.forEach((s) => { initial[s.name] = s.content; });
      setEditedSections(initial);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    const fullNote = generatedDoc?.sections
      ?.map((s) => `${s.name.toUpperCase()}\n${editedSections[s.name] ?? s.content}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(fullNote || '');
    } catch {
      setError('Could not copy to clipboard. Please select and copy manually.');
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          {NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating...' : 'Generate Note'}
        </button>
        {generatedDoc && (
          <button
            onClick={copyAll}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors"
          >
            Copy All
          </button>
        )}
      </div>

      {/* Optional context */}
      <textarea
        value={additionalContext}
        onChange={(e) => setAdditionalContext(e.target.value)}
        placeholder="Optional: add exam findings, verbal context, or clinical reasoning not in the chart..."
        className="border border-gray-300 rounded p-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Error */}
      {error && (
        <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      {/* Generated sections */}
      {generatedDoc?.sections?.map((section) => (
        <div key={section.name} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {section.name}
            </label>
            {section.sources && section.sources.length > 0 && (
              <span className="text-xs text-blue-500">
                {section.sources.length} source{section.sources.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <textarea
            value={editedSections[section.name] ?? section.content}
            onChange={(e) =>
              setEditedSections((prev) => ({ ...prev, [section.name]: e.target.value }))
            }
            className="w-full border border-gray-200 rounded p-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={Math.max(3, Math.ceil(((editedSections[section.name] || section.content || '').length) / 80))}
          />
        </div>
      ))}
    </div>
  );
};
