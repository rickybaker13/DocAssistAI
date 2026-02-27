import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NoteSection {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

interface ScribeNoteState {
  noteId: string | null;
  noteType: string;
  patientLabel: string;
  verbosity: string;
  transcript: string;
  sections: NoteSection[];
  status: 'draft' | 'finalized';

  /** Initialise a new in-progress note (called from NoteBuilderPage). */
  initNote: (data: { noteId: string; noteType: string; patientLabel: string; verbosity: string }) => void;
  setTranscript: (transcript: string) => void;
  setSections: (sections: NoteSection[]) => void;
  setStatus: (status: 'draft' | 'finalized') => void;
  /** Wipe everything (after user copies note to EHR). */
  reset: () => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Generate a client-side UUID for a new note. */
export function generateNoteId(): string {
  return uuid();
}

const INITIAL: Pick<ScribeNoteState, 'noteId' | 'noteType' | 'patientLabel' | 'verbosity' | 'transcript' | 'sections' | 'status'> = {
  noteId: null,
  noteType: '',
  patientLabel: '',
  verbosity: 'standard',
  transcript: '',
  sections: [],
  status: 'draft',
};

export const useScribeNoteStore = create<ScribeNoteState>()(
  persist(
    (set) => ({
      ...INITIAL,

      initNote: ({ noteId, noteType, patientLabel, verbosity }) =>
        set({ ...INITIAL, noteId, noteType, patientLabel, verbosity }),

      setTranscript: (transcript) => set({ transcript }),

      setSections: (sections) => set({ sections }),

      setStatus: (status) => set({ status }),

      reset: () => set({ ...INITIAL }),
    }),
    { name: 'scribe-active-note' }
  )
);
