import { useState, useCallback } from 'react';
import { getBackendUrl } from '../config/appConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncounterData {
  id: string;
  team_id: string;
  user_id: string;
  note_id: string | null;
  primary_diagnosis: string | null;
  diagnosis_codes: string[];
  acuity_scores: Record<string, number>;
  complications: string[];
  interventions: string[];
  disposition: string | null;
  admission_date: string | null;
  discharge_date: string | null;
  metadata: Record<string, unknown>;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface PopulationStats {
  total: number;
  diagnoses: { primary_diagnosis: string; count: number }[];
  complications: { complication: string; count: number }[];
  acuityAverages: Record<string, number>;
  dispositions: { disposition: string; count: number }[];
}

// ---------------------------------------------------------------------------
// useEncounterForNote — get/extract encounter data for a specific note
// ---------------------------------------------------------------------------

export function useEncounterForNote(noteId: string | null, teamId: string | null) {
  const [encounter, setEncounter] = useState<EncounterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const fetchEncounter = useCallback(async () => {
    if (!noteId || !teamId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${getBackendUrl()}/api/encounters/note/${noteId}?teamId=${teamId}`,
        { credentials: 'include' },
      );
      if (res.ok) {
        const data = await res.json();
        setEncounter(data.encounter);
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [noteId, teamId]);

  const extractFromNote = async (noteContent: string, noteType: string) => {
    if (!teamId) return;
    setExtracting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/encounters/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId, noteId, noteType, noteContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setEncounter(data.encounter);
        return data.encounter;
      }
    } catch { /* non-critical */ }
    finally { setExtracting(false); }
    return null;
  };

  const updateEncounter = async (fields: Partial<EncounterData>) => {
    if (!encounter) return;
    try {
      const res = await fetch(`${getBackendUrl()}/api/encounters/${encounter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          primaryDiagnosis: fields.primary_diagnosis,
          diagnosisCodes: fields.diagnosis_codes,
          acuityScores: fields.acuity_scores,
          complications: fields.complications,
          interventions: fields.interventions,
          disposition: fields.disposition,
          admissionDate: fields.admission_date,
          dischargeDate: fields.discharge_date,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEncounter(data.encounter);
      }
    } catch { /* non-critical */ }
  };

  const saveManual = async (fields: {
    primaryDiagnosis?: string;
    diagnosisCodes?: string[];
    acuityScores?: Record<string, number>;
    complications?: string[];
    interventions?: string[];
    disposition?: string;
  }) => {
    if (!teamId) return;
    try {
      const res = await fetch(`${getBackendUrl()}/api/encounters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId, noteId, ...fields }),
      });
      if (res.ok) {
        const data = await res.json();
        setEncounter(data.encounter);
      }
    } catch { /* non-critical */ }
  };

  return { encounter, loading, extracting, fetchEncounter, extractFromNote, updateEncounter, saveManual };
}

// ---------------------------------------------------------------------------
// usePopulationStats — population-level clinical statistics
// ---------------------------------------------------------------------------

export function usePopulationStats(teamId: string | null, dateRange: { from?: string; to?: string } = {}) {
  const [stats, setStats] = useState<PopulationStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const qs = params.toString();
      const url = `${getBackendUrl()}/api/encounters/${teamId}/stats${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [teamId, dateRange.from, dateRange.to]);

  return { stats, loading, fetchStats };
}

// ---------------------------------------------------------------------------
// usePopulationQuery — search/filter encounters
// ---------------------------------------------------------------------------

export function usePopulationQuery(teamId: string | null) {
  const [encounters, setEncounters] = useState<EncounterData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = async (filters: {
    from?: string;
    to?: string;
    diagnosis?: string;
    complication?: string;
    intervention?: string;
    disposition?: string;
    limit?: number;
    offset?: number;
  }) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [key, val] of Object.entries(filters)) {
        if (val !== undefined && val !== '') params.set(key, String(val));
      }
      const url = `${getBackendUrl()}/api/encounters/${teamId}/query?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setEncounters(data.encounters || []);
        setTotal(data.total || 0);
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  };

  return { encounters, total, loading, search };
}
