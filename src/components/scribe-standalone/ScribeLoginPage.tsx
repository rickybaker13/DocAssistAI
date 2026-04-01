import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { DocAssistLogo } from './DocAssistLogo';
import { SocialMediaLinks } from './SocialMediaLinks';

export const ScribeLoginPage: React.FC = () => {
  const { login, loading, error, user } = useScribeAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const sessionExpired = (location.state as any)?.sessionExpired === true;

  const dashboardForRole = (role?: string) =>
    role === 'billing_coder' || role === 'coding_manager'
      ? '/coder/dashboard'
      : '/scribe/dashboard';

  useEffect(() => { if (user) navigate(dashboardForRole(user.user_role)); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, password, rememberMe);
    if (ok) {
      const loggedInUser = useScribeAuthStore.getState().user;
      navigate(dashboardForRole(loggedInUser?.user_role));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <DocAssistLogo className="inline-block w-24 h-24 rounded-3xl mb-4" />
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssistAI</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        {/* Session expired banner */}
        {sessionExpired && (
          <div className="mb-4 rounded-lg bg-amber-900/50 border border-amber-700 px-4 py-3 text-sm text-amber-200 text-center">
            You were logged out due to inactivity. Please sign in again.
          </div>
        )}

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <input
                id="email" type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@hospital.org"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                id="password" type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox" checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="accent-teal-400"
              />
              Remember me for 30 days
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={loading} aria-busy={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link to="/scribe/forgot-password" className="text-slate-400 hover:text-slate-300 transition-colors mr-3">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          No account?{' '}
          <Link to="/scribe/register" className="text-teal-400 hover:text-teal-300 transition-colors">
            Create account
          </Link>
        </p>

        <SocialMediaLinks />
      </div>
    </div>
  );
};
