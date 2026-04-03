import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { DocAssistLogo } from './DocAssistLogo';
import { DISCIPLINE_OPTIONS } from '../../lib/disciplines';
import { SocialMediaLinks } from './SocialMediaLinks';

export const ScribeRegisterPage: React.FC = () => {
  const { register, loading, error, user } = useScribeAuthStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    specialty: '',
  });
  const [accountType, setAccountType] = useState<'clinical' | 'coding' | null>(null);
  const [codingPath, setCodingPath] = useState<'manager' | 'invited' | null>(null);

  useEffect(() => { if (user) navigate('/scribe/dashboard'); }, [user, navigate]);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const isCodingManager = accountType === 'coding' && codingPath === 'manager';
  const isSubmitDisabled = loading
    || accountType === null
    || (accountType === 'coding' && codingPath === null)
    || (accountType === 'coding' && codingPath === 'invited');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = isCodingManager ? 'coding_manager' : undefined;
    const ok = await register(form.email, form.password, form.name, form.specialty, role);
    if (ok) {
      if (role === 'coding_manager') {
        navigate('/coder/team');
      } else {
        navigate('/scribe/dashboard');
      }
    }
  };

  const trialHeading = isCodingManager
    ? 'Start your coding team'
    : 'Start your free 7-day trial';
  const trialDescription = isCodingManager
    ? 'Create your team account and invite billing coders. Plans start at $99/mo.'
    : 'Create your account and start documenting immediately. No payment info needed to get started.';
  const buttonText = loading
    ? 'Creating account...'
    : isCodingManager ? 'Create coding team' : 'Start free trial';
  const pricingText = accountType === 'coding'
    ? 'Coding team plans start at $99/mo with 500 notes included.'
    : 'After your trial, plans start at $20/mo.';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <DocAssistLogo className="inline-block w-24 h-24 rounded-3xl mb-4" />
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssistAI</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          <div className="mb-5 rounded-xl border border-teal-400/30 bg-teal-400/10 p-4">
            {!isCodingManager && (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">No credit card required</p>
            )}
            <h2 className="mt-1 text-lg font-semibold text-slate-50">{trialHeading}</h2>
            <p className="mt-1 text-sm text-slate-300">{trialDescription}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selector */}
            <div className="flex gap-3 mb-5">
              <button
                type="button"
                onClick={() => { setAccountType('clinical'); setCodingPath(null); }}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition-colors ${
                  accountType === 'clinical'
                    ? 'border-teal-400 bg-teal-400/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <div className="text-lg mb-1">🩺</div>
                <div className="text-sm font-semibold text-slate-100">Clinical Professional</div>
                <div className="text-xs text-slate-400 mt-1">Physicians, NPs, PAs</div>
              </button>
              <button
                type="button"
                onClick={() => { setAccountType('coding'); setForm(prev => ({ ...prev, specialty: '' })); }}
                className={`flex-1 p-4 rounded-xl border-2 text-left transition-colors ${
                  accountType === 'coding'
                    ? 'border-teal-400 bg-teal-400/10'
                    : 'border-slate-700 bg-slate-900 hover:border-slate-600'
                }`}
              >
                <div className="text-lg mb-1">📋</div>
                <div className="text-sm font-semibold text-slate-100">Billing & Coding</div>
                <div className="text-xs text-slate-400 mt-1">Coders, coding managers</div>
              </button>
            </div>

            <div>
              <label htmlFor="name" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Name (optional)</label>
              <input
                id="name" type="text" value={form.name} onChange={setField('name')}
                placeholder="Dr. Jane Smith"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
              <input
                id="reg-email" type="email" required value={form.email} onChange={setField('email')}
                placeholder="you@hospital.org"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input
                id="reg-password" type="password" required minLength={8} value={form.password} onChange={setField('password')}
                placeholder="At least 8 characters"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
              />
            </div>

            {/* Specialty dropdown — clinical only */}
            {accountType === 'clinical' && (
              <div>
                <label htmlFor="specialty" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">Specialty (optional)</label>
                <select
                  id="specialty" value={form.specialty} onChange={setField('specialty')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
                >
                  <option value="">Select specialty...</option>
                  {DISCIPLINE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            )}

            {/* Coding path options */}
            {accountType === 'coding' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">How are you getting started?</label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  codingPath === 'manager' ? 'border-teal-400 bg-teal-400/10' : 'border-slate-700 bg-slate-900'
                }`}>
                  <input type="radio" name="codingPath" value="manager" checked={codingPath === 'manager'}
                    onChange={() => setCodingPath('manager')}
                    className="text-teal-400 focus:ring-teal-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-100">I'm starting a new coding team</div>
                    <div className="text-xs text-slate-400">Create a team and invite billing coders</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  codingPath === 'invited' ? 'border-teal-400 bg-teal-400/10' : 'border-slate-700 bg-slate-900'
                }`}>
                  <input type="radio" name="codingPath" value="invited" checked={codingPath === 'invited'}
                    onChange={() => setCodingPath('invited')}
                    className="text-teal-400 focus:ring-teal-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-100">I have an invitation from my team</div>
                    <div className="text-xs text-slate-400">Use the invite link from your manager's email</div>
                  </div>
                </label>
              </div>
            )}

            {/* Invited user help text */}
            {codingPath === 'invited' && (
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-center">
                <p className="text-sm text-slate-300">Check your email for an invitation link from your coding manager.</p>
                <p className="text-xs text-slate-500 mt-2">The link will take you directly to your team's setup page.</p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={isSubmitDisabled} aria-busy={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
            >
              {buttonText}
            </button>
            <p className="text-xs text-center text-slate-500">
              {pricingText}
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/scribe/login" className="text-teal-400 hover:text-teal-300 transition-colors">
            Sign in
          </Link>
        </p>

        <SocialMediaLinks />
      </div>
    </div>
  );
};
