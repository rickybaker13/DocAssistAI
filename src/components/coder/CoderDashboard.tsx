import React, { useState, useCallback } from 'react';
import { useCoderStore } from '../../stores/coderStore';
import { NoteInputPanel } from './NoteInputPanel';
import { CoderResultsPanel } from './CoderResultsPanel';
import { WeeklyBatchTable } from './WeeklyBatchTable';

interface PatientFields {
  patientName: string;
  mrn: string;
  dateOfService: string;
  providerName: string;
  facility: string;
  noteType: string;
}

export function CoderDashboard() {
  const { lastResult, extracting, extractError } = useCoderStore();
  const [patientFields, setPatientFields] = useState<PatientFields | null>(null);

  const handleExtracted = useCallback((fields: PatientFields) => {
    setPatientFields(fields);
  }, []);

  const handleSaved = useCallback(() => {
    setPatientFields(null);
    // Re-fetch sessions to show the newly saved one
    useCoderStore.getState().fetchSessions({ limit: 50 });
  }, []);

  const showResults = !!(lastResult || extracting || extractError);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NoteInputPanel onExtracted={handleExtracted} />
        {showResults && (
          <CoderResultsPanel
            patientFields={patientFields ?? undefined}
            onSaved={handleSaved}
          />
        )}
      </div>
      <WeeklyBatchTable />
    </div>
  );
}
