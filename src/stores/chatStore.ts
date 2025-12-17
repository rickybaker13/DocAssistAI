/**
 * Chat Store
 * Manages AI chat interface state
 */

import { create } from 'zustand';
import { ChatMessage } from '../types';

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearChat: () => set({
    messages: [],
    error: null,
  }),
}));

