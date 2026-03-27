import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Users, Crown, Shield, User, Copy, Check, Trash2, Plus, Loader2, Link2 } from 'lucide-react';
import { useTeamMembers, useTeamInvites } from '../../hooks/useTeamMetrics';

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Crown className="w-4 h-4 text-amber-400" />,
  lead: <Shield className="w-4 h-4 text-teal-400" />,
  member: <User className="w-4 h-4 text-slate-400" />,
};

export const TeamManagePage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const { members, loading: loadingMembers, updateRole, removeMember } = useTeamMembers(teamId ?? null);
  const { invites, createInvite, revokeInvite } = useTeamInvites(teamId ?? null);

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState<'member' | 'lead'>('member');
  const [inviteMaxUses, setInviteMaxUses] = useState('');
  const [inviteExpiry, setInviteExpiry] = useState('24');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setError('');
    try {
      await createInvite({
        role: inviteRole,
        maxUses: inviteMaxUses ? parseInt(inviteMaxUses, 10) : undefined,
        expiresInHours: parseInt(inviteExpiry, 10),
      });
      setShowInviteForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/scribe/teams" className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <Users className="w-6 h-6 text-teal-400" />
        <h1 className="text-xl font-semibold text-white">Manage Team</h1>
      </div>

      {/* Members */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Members</h2>
        {loadingMembers ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-teal-400 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.user_id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg border border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-medium text-white">
                    {(member.name || member.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{member.name || 'Unnamed'}</p>
                    {member.email && <p className="text-xs text-slate-500">{member.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={e => updateRole(member.user_id, e.target.value)}
                    className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="member">Member</option>
                    <option value="lead">Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                  <span className="flex items-center">{ROLE_ICONS[member.role]}</span>
                  <button
                    onClick={() => removeMember(member.user_id)}
                    className="p-1 rounded hover:bg-slate-600 transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invites */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Invite Links</h2>
          <button
            onClick={() => { setShowInviteForm(true); setError(''); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Invite
          </button>
        </div>

        {/* Create Invite Form */}
        {showInviteForm && (
          <form onSubmit={handleCreateInvite} className="mb-4 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="member">Member</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Uses</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={inviteMaxUses}
                  onChange={e => setInviteMaxUses(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Expires In</label>
                <select
                  value={inviteExpiry}
                  onChange={e => setInviteExpiry(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingInvite}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Invite'}
              </button>
              <button type="button" onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
            </div>
          </form>
        )}

        {/* Invite List */}
        {invites.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No active invites. Create one to share with your team.</p>
        ) : (
          <div className="space-y-2">
            {invites.map(invite => {
              const expired = invite.expires_at && new Date(invite.expires_at) < new Date();
              const maxedOut = invite.max_uses !== null && invite.uses >= invite.max_uses;
              const inactive = expired || maxedOut;

              return (
                <div key={invite.id} className={`p-3 bg-slate-800 rounded-lg border ${inactive ? 'border-slate-700 opacity-50' : 'border-slate-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Link2 className="w-4 h-4 text-slate-500" />
                      <code className="text-teal-400 text-sm font-mono">{invite.token}</code>
                      <button
                        onClick={() => copyToken(invite.token)}
                        className="p-1 rounded hover:bg-slate-700 transition-colors"
                        title="Copy invite code"
                      >
                        {copiedToken === invite.token
                          ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                          : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {invite.uses}{invite.max_uses !== null ? `/${invite.max_uses}` : ''} used
                      </span>
                      <span className="text-xs text-slate-500">{invite.role}</span>
                      <button
                        onClick={() => revokeInvite(invite.id)}
                        className="p-1 rounded hover:bg-slate-600 transition-colors"
                        title="Revoke"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-500 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
