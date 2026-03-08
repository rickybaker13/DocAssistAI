import { create } from 'zustand';
import { getBackendUrl } from '../config/appConfig';
import { useScribeNoteStore } from './scribeNoteStore';

export interface ScribeUser {
  id: string;
  email: string;
  name: string | null;
  specialty: string | null;
  is_admin: boolean;
}

export interface SubscriptionStatus {
  subscription_status: 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  period_ends_at: string | null;
  cancelled_at: string | null;
  has_payment_method: boolean;
}

interface ScribeAuthState {
  user: ScribeUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  register: (email: string, password: string, name?: string, specialty?: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (payload: { password: string; token?: string; email?: string; otp?: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  reset: () => void;
  subscriptionStatus: SubscriptionStatus | null;
  fetchSubscriptionStatus: () => Promise<void>;
  tosAccepted: boolean | null;
  checkConsent: () => Promise<void>;
  acceptTerms: (tosVersion: string) => Promise<void>;
}

function clearNotesOnUserChange(nextUserId: string | null, prevUserId: string | null): void {
  if (prevUserId && nextUserId && prevUserId === nextUserId) return;
  useScribeNoteStore.getState().reset();
}

export const useScribeAuthStore = create<ScribeAuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  subscriptionStatus: null,
  tosAccepted: null,

  fetchSubscriptionStatus: async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/status`, { credentials: 'include' });
      if (!res.ok) {
        set({ subscriptionStatus: null });
        return;
      }
      const data = await res.json();
      set({ subscriptionStatus: data });
    } catch {
      set({ subscriptionStatus: null });
    }
  },

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
      clearNotesOnUserChange(data.user.id, get().user?.id ?? null);
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
      clearNotesOnUserChange(data.user.id, get().user?.id ?? null);
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

  resetPassword: async ({ token, email, otp, password }) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, email, otp, password }),
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

  checkConsent: async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/consent-status`, { credentials: 'include' });
      if (!res.ok) {
        set({ tosAccepted: null });
        return;
      }
      const data = await res.json();
      set({ tosAccepted: data.tosAccepted ?? false });
    } catch {
      set({ tosAccepted: null });
    }
  },

  acceptTerms: async (tosVersion: string) => {
    const res = await fetch(`${getBackendUrl()}/api/scribe/auth/accept-terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ tosVersion }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to accept terms');
    }
    set({ tosAccepted: true });
  },

  logout: async () => {
    await fetch(`${getBackendUrl()}/api/scribe/auth/logout`, { method: 'POST', credentials: 'include' });
    clearNotesOnUserChange(null, get().user?.id ?? null);
    set({ user: null, error: null, subscriptionStatus: null, tosAccepted: null });
  },

  fetchMe: async () => {
    set({ loading: true });
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        clearNotesOnUserChange(null, get().user?.id ?? null);
        set({ user: null, loading: false });
        return;
      }
      const data = await res.json();
      clearNotesOnUserChange(data.user.id, get().user?.id ?? null);
      set({ user: data.user, loading: false });
    } catch {
      clearNotesOnUserChange(null, get().user?.id ?? null);
      set({ user: null, loading: false });
    }
  },

  reset: () => set({ user: null, loading: false, error: null, subscriptionStatus: null, tosAccepted: null }),
}));
