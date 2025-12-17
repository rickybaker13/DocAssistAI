/**
 * Patient Data Store
 * Manages patient data and summary state
 */

import { create } from 'zustand';
import { PatientSummary } from '../types';

interface PatientState {
  patientSummary: PatientSummary | null;
  isLoading: boolean;
  error: string | null;
  setPatientSummary: (summary: PatientSummary) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearPatientData: () => void;
}

export const usePatientStore = create<PatientState>((set) => ({
  patientSummary: null,
  isLoading: false,
  error: null,
  setPatientSummary: (summary) => set({
    patientSummary: summary,
    error: null,
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearPatientData: () => set({
    patientSummary: null,
    error: null,
  }),
}));

