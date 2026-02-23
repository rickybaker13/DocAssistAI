/**
 * Scribe Store
 * Manages audio recording and transcription state
 */

import { create } from 'zustand';

interface ScribeState {
  isRecording: boolean;
  transcript: string;
  generatedNote: string;
  isTranscribing: boolean;
  isGenerating: boolean;
  error: string | null;
  setRecording: (v: boolean) => void;
  setTranscript: (t: string) => void;
  setGeneratedNote: (n: string) => void;
  setTranscribing: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useScribeStore = create<ScribeState>((set) => ({
  isRecording: false,
  transcript: '',
  generatedNote: '',
  isTranscribing: false,
  isGenerating: false,
  error: null,
  setRecording: (v) => set({ isRecording: v }),
  setTranscript: (t) => set({ transcript: t }),
  setGeneratedNote: (n) => set({ generatedNote: n }),
  setTranscribing: (v) => set({ isTranscribing: v }),
  setGenerating: (v) => set({ isGenerating: v }),
  setError: (e) => set({ error: e }),
  reset: () =>
    set({
      isRecording: false,
      transcript: '',
      generatedNote: '',
      isTranscribing: false,
      isGenerating: false,
      error: null,
    }),
}));
