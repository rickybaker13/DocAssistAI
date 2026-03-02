import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NoteSection {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

export type EncounterStatus = 'processing' | 'ready' | 'failed';

export interface EncounterItem {
  noteId: string;
  noteType: string;
  patientLabel: string;
  verbosity: string;
  transcript: string;
  sections: NoteSection[];
  status: EncounterStatus;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScribeNoteState {
  noteId: string | null;
  noteType: string;
  patientLabel: string;
  verbosity: string;
  transcript: string;
  sections: NoteSection[];
  status: 'draft' | 'finalized';
  encounters: EncounterItem[];

  initNote: (data: { noteId: string; noteType: string; patientLabel: string; verbosity: string }) => void;
  setTranscript: (transcript: string) => void;
  setSections: (sections: NoteSection[]) => void;
  setStatus: (status: 'draft' | 'finalized') => void;
  enqueueEncounter: (data: { noteId: string; noteType: string; patientLabel: string; verbosity: string; transcript: string }) => void;
  completeEncounter: (noteId: string, sections: NoteSection[]) => void;
  failEncounter: (noteId: string, error: string) => void;
  openEncounter: (noteId: string) => void;
  removeEncounter: (noteId: string) => void;
  reset: () => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function generateNoteId(): string {
  return uuid();
}

const INITIAL: Pick<ScribeNoteState, 'noteId' | 'noteType' | 'patientLabel' | 'verbosity' | 'transcript' | 'sections' | 'status' | 'encounters'> = {
  noteId: null,
  noteType: '',
  patientLabel: '',
  verbosity: 'standard',
  transcript: '',
  sections: [],
  status: 'draft',
  encounters: [],
};

export const useScribeNoteStore = create<ScribeNoteState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      initNote: ({ noteId, noteType, patientLabel, verbosity }) =>
        set({ ...INITIAL, encounters: get().encounters, noteId, noteType, patientLabel, verbosity }),

      setTranscript: (transcript) => set({ transcript }),

      setSections: (sections) => set({ sections }),

      setStatus: (status) => set({ status }),

      enqueueEncounter: ({ noteId, noteType, patientLabel, verbosity, transcript }) =>
        set((state) => ({
          encounters: [
            {
              noteId,
              noteType,
              patientLabel,
              verbosity,
              transcript,
              sections: [],
              status: 'processing',
              error: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            ...state.encounters.filter((item) => item.noteId !== noteId),
          ],
        })),

      completeEncounter: (noteId, sections) =>
        set((state) => ({
          encounters: state.encounters.map((item) =>
            item.noteId === noteId
              ? { ...item, sections, status: 'ready', error: null, updatedAt: new Date().toISOString() }
              : item
          ),
        })),

      failEncounter: (noteId, error) =>
        set((state) => ({
          encounters: state.encounters.map((item) =>
            item.noteId === noteId
              ? { ...item, status: 'failed', error, updatedAt: new Date().toISOString() }
              : item
          ),
        })),

      openEncounter: (noteId) =>
        set((state) => {
          const encounter = state.encounters.find((item) => item.noteId === noteId);
          if (!encounter || encounter.status !== 'ready') return state;
          return {
            noteId: encounter.noteId,
            noteType: encounter.noteType,
            patientLabel: encounter.patientLabel,
            verbosity: encounter.verbosity,
            transcript: encounter.transcript,
            sections: encounter.sections,
            status: 'draft',
          };
        }),

      removeEncounter: (noteId) => set((state) => ({ encounters: state.encounters.filter((item) => item.noteId !== noteId) })),

      reset: () => set({ ...INITIAL }),
    }),
    { name: 'scribe-active-note' }
  )
);
