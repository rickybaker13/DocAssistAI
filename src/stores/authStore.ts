/**
 * Authentication Store
 * Manages SMART launch and authentication state
 */

import { create } from 'zustand';
import { SMARTLaunchContext } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  launchContext: SMARTLaunchContext | null;
  isLoading: boolean;
  error: string | null;
  setAuthenticated: (context: SMARTLaunchContext) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  launchContext: null,
  isLoading: false,
  error: null,
  setAuthenticated: (context) => set({
    isAuthenticated: true,
    launchContext: context,
    error: null,
  }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  logout: () => set({
    isAuthenticated: false,
    launchContext: null,
    error: null,
  }),
}));

