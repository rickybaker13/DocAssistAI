import { create } from 'zustand';
import { getBackendUrl } from '../config/appConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BillingCode {
  code: string;
  description: string;
  confidence: number;
  supporting_text?: string;
  reasoning?: string;
}

export interface EMLevel {
  suggested: string;
  mdm_complexity: string;
  reasoning: string;
}

export interface CodeExtractionResult {
  icd10_codes: BillingCode[];
  cpt_codes: BillingCode[];
  em_level: EMLevel | null;
  missing_documentation: string[];
  disclaimer: string;
}

export interface CoderSession {
  id: string;
  coder_user_id: string;
  team_id: string;
  patient_name: string;
  mrn: string | null;
  date_of_service: string;
  provider_name: string;
  facility: string | null;
  note_type: string;
  icd10_codes: BillingCode[];
  cpt_codes: BillingCode[];
  em_level: EMLevel | null;
  missing_documentation: string[];
  coder_status: 'coded' | 'reviewed' | 'flagged';
  batch_week: string;
  created_at: string;
}

export interface CoderUsage {
  notes_coded: number;
  overage_notes: number;
  overage_charge_cents: number;
  month: string;
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface CoderState {
  // Extraction state
  extracting: boolean;
  extractError: string | null;
  lastResult: CodeExtractionResult | null;

  // Sessions
  sessions: CoderSession[];
  sessionsLoading: boolean;
  sessionsError: string | null;

  // Usage
  usage: CoderUsage | null;

  // Actions
  extractCodes: (noteText: string, noteType?: string, specialty?: string) => Promise<CodeExtractionResult | null>;
  saveSession: (data: {
    patientName: string;
    mrn?: string;
    dateOfService: string;
    providerName: string;
    facility?: string;
    noteType: string;
    icd10Codes: BillingCode[];
    cptCodes: BillingCode[];
    emLevel: EMLevel | null;
    missingDocumentation: string[];
  }) => Promise<CoderSession | null>;
  fetchSessions: (opts?: { limit?: number; offset?: number }) => Promise<void>;
  fetchUsage: () => Promise<void>;
  updateSessionStatus: (id: string, status: 'coded' | 'reviewed' | 'flagged') => Promise<void>;
  clearResult: () => void;
  reset: () => void;
}

export const useCoderStore = create<CoderState>((set, get) => ({
  // Initial state
  extracting: false,
  extractError: null,
  lastResult: null,
  sessions: [],
  sessionsLoading: false,
  sessionsError: null,
  usage: null,

  extractCodes: async (noteText, noteType, specialty) => {
    set({ extracting: true, extractError: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/scribe/coder/extract-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteText, noteType, specialty }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Extraction failed' }));
        set({ extracting: false, extractError: err.error || 'Extraction failed' });
        return null;
      }
      const result = await res.json();
      set({ extracting: false, lastResult: result });
      return result;
    } catch (err: any) {
      set({ extracting: false, extractError: err.message || 'Network error' });
      return null;
    }
  },

  saveSession: async (data) => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) return null;
      const session = await res.json();
      // Add to local sessions list
      set((state) => ({ sessions: [session, ...state.sessions] }));
      return session;
    } catch {
      return null;
    }
  },

  fetchSessions: async (opts = {}) => {
    set({ sessionsLoading: true, sessionsError: null });
    try {
      const params = new URLSearchParams();
      if (opts.limit) params.set('limit', String(opts.limit));
      if (opts.offset) params.set('offset', String(opts.offset));
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/sessions?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const sessions = await res.json();
      set({ sessions, sessionsLoading: false });
    } catch (err: any) {
      set({ sessionsLoading: false, sessionsError: err.message });
    }
  },

  fetchUsage: async () => {
    try {
      // Usage is fetched via team endpoint — need team id from auth store
      // For now, this is a placeholder that will be connected when team routes are wired
      // The manager's team page fetches usage directly
    } catch {
      // silent fail
    }
  },

  updateSessionStatus: async (id, status) => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ coderStatus: status }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
      }));
    } catch {
      // silent fail
    }
  },

  clearResult: () => set({ lastResult: null, extractError: null }),
  reset: () => set({
    extracting: false, extractError: null, lastResult: null,
    sessions: [], sessionsLoading: false, sessionsError: null, usage: null,
  }),
}));
