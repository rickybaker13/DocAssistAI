import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionLibrary } from './SectionLibrary';
import { NoteCanvas } from './NoteCanvas';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
];

const getBackendUrl = () => {
  try { return import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3000'; }
  catch { return 'http://localhost:3000'; }
};

export const NoteBuilderPage: React.FC = () => {
  const { canvasSections, noteType, patientLabel, setNoteType, setPatientLabel, clearCanvas } = useScribeBuilderStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const handleStartRecording = async () => {
    if (canvasSections.length === 0) { setError('Add at least one section before recording'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteType, patientLabel: patientLabel || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create note');
      navigate(`/scribe/note/${data.note.id}/record`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">New Note</h1>
        <button onClick={() => navigate('/scribe/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <select value={noteType} onChange={e => setNoteType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="text" value={patientLabel} onChange={e => setPatientLabel(e.target.value)}
          placeholder="Patient label (optional)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={`${showLibrary ? 'block' : 'hidden'} lg:block bg-white border border-gray-200 rounded-xl overflow-hidden`} style={{ maxHeight: '60vh' }}>
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Section Library</h2>
            <button onClick={() => setShowLibrary(false)} className="lg:hidden text-gray-400 text-lg">×</button>
          </div>
          <SectionLibrary />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Note Sections ({canvasSections.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowLibrary(true)} className="lg:hidden text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50">
                + Add sections
              </button>
              {canvasSections.length > 0 && (
                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-400">Clear all</button>
              )}
            </div>
          </div>
          <NoteCanvas />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
      <button onClick={handleStartRecording} disabled={creating || canvasSections.length === 0}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {creating ? 'Starting...' : '🎙 Record'}
      </button>
    </div>
  );
};
