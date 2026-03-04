import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export const ScribeForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { requestPasswordReset, loading, error } = useScribeAuthStore();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await requestPasswordReset(email);
    if (ok) {
      setSubmitted(true);
      setTimeout(() => navigate(`/scribe/reset-password?email=${encodeURIComponent(email)}`), 900);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Sparkles size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Forgot Password</h1>
          <p className="text-sm text-slate-400 mt-1">We'll email a one-time verification code.</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          {submitted ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">If an account exists for <span className="text-slate-100 font-medium">{email}</span>, a verification code has been sent.</p>
              <p className="text-xs text-slate-400">Check spam/junk if you do not see it in a few minutes.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@hospital.org"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                />
              </div>
              {error && <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link to="/scribe/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
