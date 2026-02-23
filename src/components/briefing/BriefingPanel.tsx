import React, { useEffect, useState, useCallback, useRef } from 'react';
import { signalService } from '../../services/signal/signalService';
import { SignalDomainCard } from './SignalDomainCard';
import { usePatientStore } from '../../stores/patientStore';
import { fhirClientService } from '../../services/fhir/fhirClientService';
import { ICUPatientData, PatientSignal } from '../../types';

const TIME_WINDOWS = [6, 12, 24, 48] as const;
type TimeWindow = typeof TIME_WINDOWS[number];

export const BriefingPanel: React.FC = () => {
  const [signal, setSignal] = useState<PatientSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoursBack, setHoursBack] = useState<TimeWindow>(24);
  const [showStable, setShowStable] = useState(false);
  const { patientSummary } = usePatientStore();
  const patient = patientSummary?.patient;

  // Fix 2: Cache patient data and session ID in refs to avoid re-fetching on window changes
  const patientDataRef = useRef<ICUPatientData | null>(null);
  const sessionIdRef = useRef<string>('');

  // Fix 3: Race condition guard — track load ID to discard stale responses
  const loadIdRef = useRef(0);

  const loadBriefing = useCallback(async (hours: TimeWindow) => {
    if (!patient?.id) return;

    // Fix 3: Increment load ID and capture it for this invocation
    const myLoadId = ++loadIdRef.current;

    setLoading(true);
    setError(null);
    try {
      // Fix 2: Use cached patient data or fetch fresh on first load
      if (!patientDataRef.current) {
        patientDataRef.current = await fhirClientService.getICUPatientData(patient.id);
      }
      // Fix 2: Use stable session ID (generate once per patient)
      if (!sessionIdRef.current) {
        sessionIdRef.current = `${patient.id}-${Date.now()}`;
      }
      const result = await signalService.process(patientDataRef.current, hours, sessionIdRef.current);

      // Fix 3: Discard stale response if a newer load has been started
      if (myLoadId !== loadIdRef.current) return;

      setSignal(result);
    } catch (err: unknown) {
      if (myLoadId !== loadIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load briefing');
    } finally {
      if (myLoadId === loadIdRef.current) {
        setLoading(false);
      }
    }
  }, [patient?.id]);

  // Fix 2: Reset cache refs when patient changes
  useEffect(() => {
    patientDataRef.current = null;
    sessionIdRef.current = '';
  }, [patient?.id]);

  // Fix 1: Pass fixed default 24 — no stale closure on hoursBack
  useEffect(() => {
    if (patient?.id) {
      loadBriefing(24); // Always start with 24h on patient load
    }
  }, [patient?.id, loadBriefing]);

  const handleWindowChange = (hours: TimeWindow) => {
    setHoursBack(hours);
    loadBriefing(hours);
  };

  if (!patient?.id) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
        <span className="text-3xl">🏥</span>
        <p className="text-sm">No patient loaded. Open a patient in your EHR to begin.</p>
      </div>
    );
  }

  if (loading) {
    return (
      // Fix 7: Add role="status" to loading wrapper
      <div role="status" className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-sm text-gray-500">Analyzing patient data...</p>
      </div>
    );
  }

  // Fix 4: Render time window controls first, error inline below them (no early return for error)
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Time window selector — always visible whenever patient is set */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 font-medium">Time window:</span>
        {TIME_WINDOWS.map(h => (
          <button
            key={h}
            onClick={() => handleWindowChange(h)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              hoursBack === h
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {h}h
          </button>
        ))}
        {/* Fix 7: aria-label on refresh button, aria-hidden on decorative character */}
        <button
          onClick={() => loadBriefing(hoursBack)}
          aria-label="Refresh briefing"
          className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <span aria-hidden="true">↻</span> Refresh
        </button>
      </div>

      {/* Fix 4: Error shown inline below time window controls, not as early return */}
      {error && (
        <div className="p-4">
          <div className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-3">{error}</div>
          <button onClick={() => loadBriefing(hoursBack)} className="mt-2 text-xs text-blue-600 hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Remaining signal content — only shown when there is no error and signal is loaded */}
      {!error && signal && (
        <>
          {/* Headline */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3">
            <p className="text-xs font-semibold text-yellow-700 mb-1">KEY FINDING</p>
            <p className="text-sm font-medium text-gray-800">{signal.headline}</p>
          </div>

          {/* Domain cards */}
          {signal.domains?.length > 0 && (
            <div className="grid grid-cols-1 gap-3">
              {signal.domains.map((domain, i) => (
                <SignalDomainCard key={i} domain={domain} />
              ))}
            </div>
          )}

          {/* Pending */}
          {signal.pending?.length > 0 && (
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-2">⏳ PENDING</p>
              <ul className="space-y-1">
                {signal.pending.map((p, i) => (
                  <li key={i} className="text-sm text-gray-700">• {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Stable — collapsible */}
          {signal.stable?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <button
                onClick={() => setShowStable(s => !s)}
                className="text-xs font-semibold text-gray-500 flex items-center gap-1 w-full text-left"
              >
                ✓ STABLE / UNCHANGED ({signal.stable.length}) {showStable ? '▲' : '▼'}
              </button>
              {showStable && (
                <ul className="mt-2 space-y-1">
                  {signal.stable.map((s, i) => (
                    <li key={i} className="text-sm text-gray-500">• {s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Footer timestamp */}
          <p className="text-xs text-gray-400 text-right">
            Generated {new Date(signal.generatedAt).toLocaleTimeString()} · {signal.timeWindowHours}h window
          </p>
        </>
      )}
    </div>
  );
};
