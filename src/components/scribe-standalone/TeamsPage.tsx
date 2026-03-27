import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Plus, LogIn, Settings, BarChart3, Loader2, Crown, Shield, User, Trash2 } from 'lucide-react';
import { useTeams } from '../../hooks/useTeamMetrics';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Crown className="w-4 h-4 text-amber-400" />,
  lead: <Shield className="w-4 h-4 text-teal-400" />,
  member: <User className="w-4 h-4 text-slate-400" />,
};

export const TeamsPage: React.FC = () => {
  const { teams, loading, createTeam, joinTeam, deleteTeam } = useTeams();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [joinToken, setJoinToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await createTeam(name.trim(), specialty.trim() || undefined);
      setShowCreate(false);
      setName('');
      setSpecialty('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinToken.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await joinTeam(joinToken.trim());
      setShowJoin(false);
      setJoinToken('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (teamId: string) => {
    try {
      await deleteTeam(teamId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/scribe/dashboard" className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <Users className="w-6 h-6 text-teal-400" />
        <h1 className="text-xl font-semibold text-white">Teams</h1>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Create Team
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <LogIn className="w-4 h-4" /> Join Team
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-sm font-medium text-white">Create a New Team</h3>
          <input
            type="text"
            placeholder="Team name (e.g., ICU Alpha)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Specialty (optional, e.g., Critical Care)"
            value={specialty}
            onChange={e => setSpecialty(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Join Form */}
      {showJoin && (
        <form onSubmit={handleJoin} className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
          <h3 className="text-sm font-medium text-white">Join a Team</h3>
          <input
            type="text"
            placeholder="Enter invite code"
            value={joinToken}
            onChange={e => setJoinToken(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !joinToken.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Join'}
            </button>
            <button type="button" onClick={() => setShowJoin(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Team List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-teal-400 animate-spin" /></div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No teams yet. Create one or join with an invite code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="p-4 bg-slate-800 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-medium">{team.name}</h3>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      {ROLE_ICONS[team.role]} {team.role}
                    </span>
                  </div>
                  {team.specialty && (
                    <p className="text-sm text-slate-400">{team.specialty}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    to={`/scribe/teams/${team.id}/metrics`}
                    className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                    title="View Metrics"
                  >
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                  </Link>
                  {(team.role === 'admin' || team.role === 'lead') && (
                    <Link
                      to={`/scribe/teams/${team.id}/manage`}
                      className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Manage Team"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                    </Link>
                  )}
                  {team.role === 'admin' && (
                    confirmDeleteId === team.id ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(team.id)} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-xs">Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 text-slate-400 text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(team.id)}
                        className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
                        title="Delete Team"
                      >
                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-400" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
