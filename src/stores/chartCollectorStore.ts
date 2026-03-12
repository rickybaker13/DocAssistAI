import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const FRAGMENT_LABELS = [
  'Labs',
  'Imaging',
  'H&P',
  'Med List',
  'Vitals',
  'Consult Note',
  'Nursing Note',
  'Operative Report',
  'Other',
] as const;

export type FragmentLabel = (typeof FRAGMENT_LABELS)[number];

export interface ChartFragment {
  id: string;
  label: FragmentLabel;
  text: string;
  addedAt: string;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ChartCollectorState {
  fragments: ChartFragment[];
  noteType: string;
  patientLabel: string;
  verbosity: 'concise' | 'brief' | 'standard' | 'detailed';

  addFragment: (text: string, label: FragmentLabel) => void;
  removeFragment: (id: string) => void;
  updateFragmentLabel: (id: string, label: FragmentLabel) => void;
  reorderFragments: (fromIndex: number, toIndex: number) => void;
  setNoteType: (t: string) => void;
  setPatientLabel: (l: string) => void;
  setVerbosity: (v: 'concise' | 'brief' | 'standard' | 'detailed') => void;
  clearAll: () => void;
}

export const useChartCollectorStore = create<ChartCollectorState>()(
  persist(
    (set) => ({
      fragments: [],
      noteType: 'discharge_summary',
      patientLabel: '',
      verbosity: 'standard',

      addFragment: (text, label) =>
        set((state) => ({
          fragments: [
            ...state.fragments,
            { id: uuid(), label, text, addedAt: new Date().toISOString() },
          ],
        })),

      removeFragment: (id) =>
        set((state) => ({ fragments: state.fragments.filter((f) => f.id !== id) })),

      updateFragmentLabel: (id, label) =>
        set((state) => ({
          fragments: state.fragments.map((f) => (f.id === id ? { ...f, label } : f)),
        })),

      reorderFragments: (fromIndex, toIndex) =>
        set((state) => {
          const arr = [...state.fragments];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { fragments: arr };
        }),

      setNoteType: (noteType) => set({ noteType }),
      setPatientLabel: (patientLabel) => set({ patientLabel }),
      setVerbosity: (verbosity) => set({ verbosity }),
      clearAll: () => set({ fragments: [], noteType: 'discharge_summary', patientLabel: '', verbosity: 'standard' }),
    }),
    { name: 'chart-collector' }
  )
);
