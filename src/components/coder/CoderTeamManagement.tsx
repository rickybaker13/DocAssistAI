import { useState, useEffect, useCallback } from 'react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';

/* ── Types ─────────────────────────────────────────────────────────── */

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  status: 'active' | 'pending' | 'deactivated';
}

interface TeamData {
  id: string;
  name: string;
  members: TeamMember[];
}

interface TeamUsage {
  used: number;
  included: number;
  overage: number;
  overage_cost: number;
}

/* ── TeamUsageBar ──────────────────────────────────────────────────── */

function TeamUsageBar({ teamId }: { teamId: string }) {
  const [usage, setUsage] = useState<TeamUsage | null>(null);

  useEffect(() => {
    const url = `${getBackendUrl()}/api/scribe/coder/teams/${teamId}/usage`;
    fetch(url, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setUsage)
      .catch(() => {});
  }, [teamId]);

  if (!usage) return null;

  const pct = Math.min((usage.used / usage.included) * 100, 100);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 mb-6">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">Monthly Usage</h3>
      <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
          data-testid="usage-fill"
        />
      </div>
      <p className="text-sm text-slate-300 mt-2">
        {usage.used} / {usage.included} notes this month
      </p>
      {usage.overage > 0 && (
        <p className="text-sm text-amber-400 mt-1">
          {usage.overage} overage notes (${usage.overage_cost.toFixed(2)})
        </p>
      )}
    </div>
  );
}

/* ── Status Badge ──────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: TeamMember['status'] }) {
  const colors: Record<string, string> = {
    active: 'bg-green-900/50 text-green-400 border-green-700',
    pending: 'bg-amber-900/50 text-amber-400 border-amber-700',
    deactivated: 'bg-red-900/50 text-red-400 border-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[status] ?? ''}`}>
      {status}
    </span>
  );
}

/* ── Main Component ────────────────────────────────────────────────── */

export function CoderTeamManagement() {
  const user = useScribeAuthStore((s) => s.user);
  const teamId = user?.coding_team_id;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/teams/${teamId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load team');
      const data = await res.json();
      setTeam(data);
      setError(null);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  /* ── Member actions ─────────────────────────────────────────────── */

  const toggleMemberStatus = async (memberId: string, newStatus: 'active' | 'deactivated') => {
    if (!teamId) return;
    try {
      const res = await fetch(
        `${getBackendUrl()}/api/scribe/coder/teams/${teamId}/members/${memberId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!res.ok) throw new Error('Update failed');
      await fetchTeam();
    } catch {
      // silent
    }
  };

  /* ── Invite ─────────────────────────────────────────────────────── */

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId || !inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    setInviteError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/teams/${teamId}/invite`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Invite failed');
      }
      setInviteMsg(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      await fetchTeam();
    } catch (err: any) {
      setInviteError(err.message ?? 'Unknown error');
    } finally {
      setInviting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  if (!teamId) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-400">
        No team assigned.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-slate-400">
        Loading team data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-red-400">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100 mb-6">{team?.name ?? 'Team'}</h1>

      {/* Usage */}
      <TeamUsageBar teamId={teamId} />

      {/* Members */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 mb-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Members</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {team?.members.map((m) => (
                <tr key={m.id} className="border-b border-slate-800 text-slate-300">
                  <td className="py-2 pr-4">{m.name ?? '—'}</td>
                  <td className="py-2 pr-4">{m.email}</td>
                  <td className="py-2 pr-4">{m.role}</td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="py-2">
                    {m.status === 'active' && (
                      <button
                        onClick={() => toggleMemberStatus(m.id, 'deactivated')}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Deactivate
                      </button>
                    )}
                    {m.status === 'deactivated' && (
                      <button
                        onClick={() => toggleMemberStatus(m.id, 'active')}
                        className="text-xs text-teal-400 hover:text-teal-300"
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite */}
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Invite Coder</h3>
        <form onSubmit={handleInvite} className="flex gap-3 items-start">
          <input
            type="email"
            placeholder="coder@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={inviting}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm rounded font-medium"
          >
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
        </form>
        {inviteMsg && <p className="text-green-400 text-sm mt-2">{inviteMsg}</p>}
        {inviteError && <p className="text-red-400 text-sm mt-2">{inviteError}</p>}
      </div>
    </div>
  );
}
