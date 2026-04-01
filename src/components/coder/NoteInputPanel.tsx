import React, { useState } from 'react';
import { useCoderStore } from '../../stores/coderStore';

const NOTE_TYPES = [
  'ED Visit',
  'Inpatient',
  'Outpatient',
  'Procedure Note',
  'Consult',
  'Progress Note',
] as const;

interface NoteInputPanelProps {
  onExtracted?: (fields: {
    patientName: string;
    mrn: string;
    dateOfService: string;
    providerName: string;
    facility: string;
    noteType: string;
  }) => void;
}

export function NoteInputPanel({ onExtracted }: NoteInputPanelProps) {
  const { extracting } = useCoderStore();

  const [patientName, setPatientName] = useState('');
  const [mrn, setMrn] = useState('');
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [providerName, setProviderName] = useState('');
  const [facility, setFacility] = useState('');
  const [noteType, setNoteType] = useState<string>(NOTE_TYPES[0]);
  const [noteText, setNoteText] = useState('');

  const canSubmit =
    !extracting &&
    patientName.trim() !== '' &&
    providerName.trim() !== '' &&
    dateOfService !== '' &&
    noteText.trim() !== '';

  const handleGenerate = async () => {
    if (!canSubmit) return;
    const result = await useCoderStore
      .getState()
      .extractCodes(noteText, noteType);
    if (result && onExtracted) {
      onExtracted({
        patientName,
        mrn,
        dateOfService,
        providerName,
        facility,
        noteType,
      });
    }
  };

  const inputClass =
    'bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none w-full';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        Patient Info
      </h2>

      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Patient Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Last, First"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">MRN</label>
          <input
            type="text"
            value={mrn}
            onChange={(e) => setMrn(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Date of Service <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={dateOfService}
            onChange={(e) => setDateOfService(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Provider <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="Provider name"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Facility</label>
          <input
            type="text"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Note Type <span className="text-red-400">*</span>
          </label>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className={inputClass}
          >
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Textarea */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">
          Clinical Note <span className="text-red-400">*</span>
        </label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Paste clinical note here..."
          className={`${inputClass} min-h-[200px] resize-y`}
        />
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canSubmit}
        className="w-full bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-lg py-2.5 transition-colors"
      >
        {extracting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Extracting codes...
          </span>
        ) : (
          'Generate Codes'
        )}
      </button>
    </div>
  );
}
