import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../config/appConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
  specialty: string | null;
  settings: Record<string, unknown>;
  role: 'admin' | 'lead' | 'member';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  user_id: string;
  name: string | null;
  email?: string;
  role: 'admin' | 'lead' | 'member';
  joined_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  token: string;
  role: 'admin' | 'lead' | 'member';
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

export interface MetricSummary {
  event_type: string;
  count: number;
}

export interface DailySummary {
  event_date: string;
  event_type: string;
  count: number;
}

export interface ProviderSummary {
  user_id: string;
  name: string | null;
  email: string;
  event_type: string;
  count: number;
}

// ---------------------------------------------------------------------------
// useTeams — team CRUD and membership
// ---------------------------------------------------------------------------

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/teams`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const createTeam = async (name: string, specialty?: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, specialty }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const data = await res.json();
    setTeams(prev => [{ ...data.team, role: data.role }, ...prev]);
    return data.team;
  };

  const joinTeam = async (token: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const data = await res.json();
    setTeams(prev => [{ ...data.team, role: data.role }, ...prev]);
    return data;
  };

  const deleteTeam = async (teamId: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    setTeams(prev => prev.filter(t => t.id !== teamId));
  };

  return { teams, loading, error, fetchTeams, createTeam, joinTeam, deleteTeam };
}

// ---------------------------------------------------------------------------
// useTeamMembers
// ---------------------------------------------------------------------------

export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/members`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMembers(data.members || []);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [teamId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const updateRole = async (userId: string, role: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/members/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: role as any } : m));
  };

  const removeMember = async (userId: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    setMembers(prev => prev.filter(m => m.user_id !== userId));
  };

  return { members, loading, fetchMembers, updateRole, removeMember };
}

// ---------------------------------------------------------------------------
// useTeamInvites
// ---------------------------------------------------------------------------

export function useTeamInvites(teamId: string | null) {
  const [invites, setInvites] = useState<TeamInvite[]>([]);

  const fetchInvites = useCallback(async () => {
    if (!teamId) return;
    try {
      const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/invites`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setInvites(data.invites || []);
    } catch { /* non-critical */ }
  }, [teamId]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const createInvite = async (opts: { role?: string; maxUses?: number; expiresInHours?: number }) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(opts),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    const data = await res.json();
    setInvites(prev => [data.invite, ...prev]);
    return data.invite as TeamInvite;
  };

  const revokeInvite = async (inviteId: string) => {
    const res = await fetch(`${getBackendUrl()}/api/teams/${teamId}/invites/${inviteId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    setInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  return { invites, fetchInvites, createInvite, revokeInvite };
}

// ---------------------------------------------------------------------------
// useMetrics — metric queries
// ---------------------------------------------------------------------------

export function useMetrics(teamId: string | null, dateRange: { from?: string; to?: string } = {}) {
  const [summary, setSummary] = useState<MetricSummary[]>([]);
  const [daily, setDaily] = useState<DailySummary[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const base = `${getBackendUrl()}/api/metrics/${teamId}`;
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const qs = params.toString();
      const suffix = qs ? `?${qs}` : '';

      const [summaryRes, dailyRes, providersRes] = await Promise.all([
        fetch(`${base}/summary${suffix}`, { credentials: 'include' }),
        fetch(`${base}/daily${suffix}`, { credentials: 'include' }),
        fetch(`${base}/providers${suffix}`, { credentials: 'include' }).catch(() => null),
      ]);

      if (summaryRes.ok) { const d = await summaryRes.json(); setSummary(d.summary || []); }
      if (dailyRes.ok) { const d = await dailyRes.json(); setDaily(d.daily || []); }
      if (providersRes?.ok) { const d = await providersRes.json(); setProviders(d.providers || []); }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, [teamId, dateRange.from, dateRange.to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const logEvent = async (eventType: string, metadata?: Record<string, unknown>) => {
    if (!teamId) return;
    await fetch(`${getBackendUrl()}/api/metrics/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ teamId, eventType, metadata }),
    });
  };

  return { summary, daily, providers, loading, fetchAll, logEvent };
}
