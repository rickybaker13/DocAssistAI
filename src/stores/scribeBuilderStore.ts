import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';

export interface CanvasSection {
  canvasId: string;
  templateId: string;
  name: string;
  promptHint: string | null;
  isPrebuilt: boolean;
}

interface ScribeBuilderState {
  canvasSections: CanvasSection[];
  noteType: string;
  patientLabel: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  selectedTemplateId: string | null;
  addSection: (template: { id: string; name: string; promptHint: string | null; isPrebuilt: boolean }) => void;
  removeSection: (templateId: string) => void;
  reorderSections: (activeTemplateId: string, overTemplateId: string) => void;
  clearCanvas: () => void;
  setNoteType: (t: string) => void;
  setPatientLabel: (l: string) => void;
  setVerbosity: (v: 'brief' | 'standard' | 'detailed') => void;
  setSelectedTemplate: (templateId: string, sections: CanvasSection[]) => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useScribeBuilderStore = create<ScribeBuilderState>()(
  persist(
    (set, get) => ({
      canvasSections: [],
      noteType: 'progress_note',
      patientLabel: '',
      verbosity: 'standard',
      selectedTemplateId: null,

      addSection: (template) => {
        const existing = get().canvasSections.find(s => s.templateId === template.id);
        if (existing) return;
        set(state => ({
          canvasSections: [
            ...state.canvasSections,
            { canvasId: uuid(), templateId: template.id, name: template.name, promptHint: template.promptHint, isPrebuilt: template.isPrebuilt },
          ],
        }));
      },

      removeSection: (templateId) => {
        set(state => ({ canvasSections: state.canvasSections.filter(s => s.templateId !== templateId) }));
      },

      reorderSections: (activeTemplateId, overTemplateId) => {
        set(state => {
          const items = state.canvasSections;
          const activeIdx = items.findIndex(s => s.templateId === activeTemplateId);
          const overIdx = items.findIndex(s => s.templateId === overTemplateId);
          if (activeIdx === -1 || overIdx === -1) return state;
          return { canvasSections: arrayMove(items, activeIdx, overIdx) };
        });
      },

      clearCanvas: () => set({ canvasSections: [] }),
      setNoteType: (noteType) => set({ noteType }),
      setPatientLabel: (patientLabel) => set({ patientLabel }),
      setVerbosity: (verbosity) => set({ verbosity }),
      setSelectedTemplate: (templateId, sections) => set({
        selectedTemplateId: templateId,
        canvasSections: sections,
      }),
    }),
    { name: 'scribe-builder-canvas' }
  )
);
