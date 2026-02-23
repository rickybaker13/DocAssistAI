/**
 * Discovery Store
 * Zustand store for note discovery state
 */

import { create } from 'zustand';
import { NormalizedNote, DiscoveryReport } from '../types';

interface DiscoveryState {
  // Discovery state
  isDiscovering: boolean;
  discoveryError: string | null;
  discoveryReport: DiscoveryReport | null;
  discoveredNotes: NormalizedNote[];
  
  // UI state
  selectedNoteType: string | null;
  selectedProvider: string | null;
  activeTab: 'overview' | 'noteTypes' | 'providers' | 'structures' | 'mapping';
  
  // Actions
  setDiscovering: (isDiscovering: boolean) => void;
  setDiscoveryError: (error: string | null) => void;
  setDiscoveryReport: (report: DiscoveryReport | null) => void;
  setDiscoveredNotes: (notes: NormalizedNote[]) => void;
  setSelectedNoteType: (type: string | null) => void;
  setSelectedProvider: (provider: string | null) => void;
  setActiveTab: (tab: 'overview' | 'noteTypes' | 'providers' | 'structures' | 'mapping') => void;
  clearDiscovery: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  // Initial state
  isDiscovering: false,
  discoveryError: null,
  discoveryReport: null,
  discoveredNotes: [],
  selectedNoteType: null,
  selectedProvider: null,
  activeTab: 'overview',

  // Actions
  setDiscovering: (isDiscovering) => set({ isDiscovering }),
  setDiscoveryError: (error) => set({ discoveryError: error }),
  setDiscoveryReport: (report) => set({ discoveryReport: report }),
  setDiscoveredNotes: (notes) => set({ discoveredNotes: notes }),
  setSelectedNoteType: (type) => set({ selectedNoteType: type }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  clearDiscovery: () => set({
    isDiscovering: false,
    discoveryError: null,
    discoveryReport: null,
    discoveredNotes: [],
    selectedNoteType: null,
    selectedProvider: null,
    activeTab: 'overview',
  }),
}));

