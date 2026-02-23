/**
 * Document Store
 * Manages document generation state
 */

import { create } from 'zustand';

export interface GeneratedDocument {
  content: string;
  sections: Record<string, string>;
  metadata: {
    templateId: string;
    noteType: string;
    generatedAt: string;
    author: string;
  };
}

export interface QualityCheck {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

export interface DocumentState {
  currentDocument: GeneratedDocument | null;
  qualityCheck: QualityCheck | null;
  isGenerating: boolean;
  isEditing: boolean;
  editHistory: string[];
  selectedTemplate: string | null;
  userContext: {
    role: 'MD' | 'NP' | 'PA' | 'RN' | 'PT' | 'ST' | 'RT' | 'WC' | 'PC' | 'CH' | 'OTHER';
    service?: string;
    name?: string;
  } | null;
  setCurrentDocument: (doc: GeneratedDocument | null) => void;
  setQualityCheck: (check: QualityCheck | null) => void;
  setGenerating: (generating: boolean) => void;
  setEditing: (editing: boolean) => void;
  addEditHistory: (edit: string) => void;
  setSelectedTemplate: (template: string | null) => void;
  setUserContext: (context: DocumentState['userContext']) => void;
  clearDocument: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  currentDocument: null,
  qualityCheck: null,
  isGenerating: false,
  isEditing: false,
  editHistory: [],
  selectedTemplate: null,
  userContext: null,
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  setQualityCheck: (check) => set({ qualityCheck: check }),
  setGenerating: (generating) => set({ isGenerating: generating }),
  setEditing: (editing) => set({ isEditing: editing }),
  addEditHistory: (edit) => set((state) => ({ editHistory: [...state.editHistory, edit] })),
  setSelectedTemplate: (template) => set({ selectedTemplate: template }),
  setUserContext: (context) => set({ userContext: context }),
  clearDocument: () => set({
    currentDocument: null,
    qualityCheck: null,
    editHistory: [],
    selectedTemplate: null,
  }),
}));

