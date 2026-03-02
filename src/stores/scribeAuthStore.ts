import { create } from 'zustand';
import { getBackendUrl } from '../config/appConfig';

export interface ScribeUser {
  id: string;
  email: string;
  name: string | null;
  specialty: string | null;
}

interface ScribeAuthState {
  user: ScribeUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (email: string, password: string, name?: string, specialty?: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  reset: () => void;
}

export const useScribeAuthStore = create<ScribeAuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  login: async (email, password, rememberMe = false) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) { set({ loading: false, error: data.error || 'Login failed' }); return false; }
      set({ user: data.user, loading: false, error: null });
      return true;
    } catch (e: any) {
      const msg = e instanceof TypeError ? 'Unable to reach server. Check your connection.' : e.message;
      set({ loading: false, error: msg });
      return false;
    }
  },

  register: async (email, password, name?, specialty?) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name, specialty }),
      });
      const data = await res.json();
      if (!res.ok) { set({ loading: false, error: data.error || 'Registration failed' }); return false; }
      set({ user: data.user, loading: false, error: null });
      return true;
    } catch (e: any) {
      const msg = e instanceof TypeError ? 'Unable to reach server. Check your connection.' : e.message;
      set({ loading: false, error: msg });
      return false;
    }
  },

  requestPasswordReset: async (email) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { set({ loading: false, error: data.error || 'Password reset request failed' }); return false; }
      set({ loading: false, error: null });
      return true;
    } catch (e: any) {
      const msg = e instanceof TypeError ? 'Unable to reach server. Check your connection.' : e.message;
      set({ loading: false, error: msg });
      return false;
    }
  },

  resetPassword: async (token, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { set({ loading: false, error: data.error || 'Password reset failed' }); return false; }
      set({ loading: false, error: null });
      return true;
    } catch (e: any) {
      const msg = e instanceof TypeError ? 'Unable to reach server. Check your connection.' : e.message;
      set({ loading: false, error: msg });
      return false;
    }
  },

  logout: async () => {
    await fetch(`${getBackendUrl()}/api/scribe/auth/logout`, { method: 'POST', credentials: 'include' });
    set({ user: null, error: null });
  },

  fetchMe: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/me`, { credentials: 'include' });
      if (!res.ok) { set({ user: null, loading: false }); return; }
      const data = await res.json();
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },

  reset: () => set({ user: null, loading: false, error: null }),
}));
