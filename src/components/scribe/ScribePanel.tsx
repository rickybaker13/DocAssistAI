import React, { useState } from 'react';
import { useScribeStore } from '../../stores/scribeStore';
import { AudioRecorder } from './AudioRecorder';
import { NoteEditor } from './NoteEditor';
import { getBackendUrl } from '../../config/appConfig';

const NOTE_TYPES = [
  'Progress Note',
  'H&P',
  'Transfer Note',
  'Accept Note',
  'Consult Note',
  'Discharge Summary',
  'Procedure Note',
] as const;

type NoteType = (typeof NOTE_TYPES)[number];

// Map display note type to backend noteType value
const NOTE_TYPE_MAP: Record<NoteType, string> = {
  'Progress Note': 'progress_note',
  'H&P': 'history_and_physical',
  'Transfer Note': 'transfer_note',
  'Accept Note': 'accept_note',
  'Consult Note': 'consult_note',
  'Discharge Summary': 'discharge_summary',
  'Procedure Note': 'procedure_note',
};

export const ScribePanel: React.FC = () => {
  const [noteType, setNoteType] = useState<NoteType>('Progress Note');

  const {
    transcript,
    generatedNote,
    isGenerating,
    error,
    setTranscript,
    setGeneratedNote,
    setGenerating,
    setError,
  } = useScribeStore();

  const generateNote = async (text: string, selectedNoteType: NoteType) => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType: NOTE_TYPE_MAP[selectedNoteType],
          userContext: { role: 'MD', service: 'Internal Medicine' },
          patientId: sessionStorage.getItem('patientId') ?? 'unknown',
          date: new Date().toISOString(),
          // Wrap transcript as patient summary so the backend has context
          patientSummary: {
            transcript: text,
            clinicalNotes: [{ content: text, type: 'Scribe Transcript' }],
          },
        }),
      });

      if (!res.ok) {
        let serverMessage: string;
        try {
          const errData = (await res.json()) as { error?: string };
          serverMessage = errData.error ?? `Server error: ${res.status}`;
        } catch {
          serverMessage = `Server error: ${res.status}`;
        }
        setError(serverMessage);
        return;
      }

      const data = (await res.json()) as {
        success: boolean;
        data?: { document?: { content?: string } };
        error?: string;
      };

      if (data.success && data.data?.document?.content != null) {
        setGeneratedNote(data.data.document.content);
      } else {
        setError(data.error ?? 'Note generation failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Note generation request failed';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleTranscript = (text: string) => {
    setTranscript(text);
    generateNote(text, noteType);
  };

  const handleError = (message: string) => {
    setError(message);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedNote);
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Note type selector */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-semibold text-gray-700" htmlFor="note-type-select">
          Note Type
        </label>
        <select
          id="note-type-select"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as NoteType)}
          disabled={isGenerating}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {NOTE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      {/* Audio recorder */}
      <AudioRecorder onTranscript={handleTranscript} onError={handleError} />

      {/* Transcript display */}
      {transcript && (
        <div className="bg-gray-100 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
            Transcript
          </p>
          <p className="text-sm text-gray-800">{transcript}</p>
        </div>
      )}

      {/* Generating spinner */}
      {isGenerating && (
        <div className="flex items-center gap-2 text-blue-600 animate-pulse">
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-sm font-medium">Generating note...</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Generated note editor */}
      {generatedNote && (
        <NoteEditor
          note={generatedNote}
          onChange={setGeneratedNote}
          onCopy={handleCopy}
        />
      )}
    </div>
  );
};
