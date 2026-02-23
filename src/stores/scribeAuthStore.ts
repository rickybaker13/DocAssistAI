import { create } from 'zustand';

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
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  reset: () => void;
}

const getBackendUrl = () => {
  try {
    return import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
};

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
      set({ loading: false, error: e.message });
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
      set({ loading: false, error: e.message });
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
