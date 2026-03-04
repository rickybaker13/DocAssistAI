import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export const ScribeResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const emailFromQuery = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const navigate = useNavigate();
  const { resetPassword, loading, error } = useScribeAuthStore();
  const [email, setEmail] = useState(emailFromQuery);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!token) {
      if (!email) {
        setLocalError('Email is required.');
        return;
      }
      if (!/^\d{6}$/.test(otp)) {
        setLocalError('Enter the 6-digit code sent to your email.');
        return;
      }
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    const ok = await resetPassword({ token, email, otp, password });
    if (ok) {
      setSubmitted(true);
      setTimeout(() => navigate('/scribe/login'), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Sparkles size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Set New Password</h1>
          <p className="text-sm text-slate-400 mt-1">Enter your email + one-time code, then choose a new password.</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          {submitted ? (
            <p className="text-sm text-emerald-400">Password updated. Redirecting to sign in…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <>
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="otp" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Verification Code</label>
                    <input
                      id="otp"
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                    />
                  </div>
                </>
              )}
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                />
              </div>
              {(localError || error) && (
                <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{localError || error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                aria-busy={loading}
                className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Updating…' : 'Update password'}
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
