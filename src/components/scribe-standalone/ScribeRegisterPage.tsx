import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Sparkles } from 'lucide-react';
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
    agreedToAutoRenewal: false,
  });
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => { if (user) navigate('/scribe/dashboard'); }, [user, navigate]);

  const setField = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = field === 'agreedToAutoRenewal' && e.target instanceof HTMLInputElement
      ? e.target.checked
      : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const isBillingFormValid = () => {
    if (!form.agreedToAutoRenewal) return 'You must agree to auto-renewal terms to start the trial.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const billingValidationError = isBillingFormValid();
    if (billingValidationError) {
      setBillingError(billingValidationError);
      return;
    }
    setBillingError(null);
    const ok = await register(form.email, form.password, form.name, form.specialty);
    if (ok) navigate('/scribe/account');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400 rounded-2xl mb-4">
            <Sparkles size={28} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">DocAssistAI</h1>
          <p className="text-sm text-slate-400 mt-1">Clinical documentation, simplified</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
          <div className="mb-5 rounded-xl border border-teal-400/30 bg-teal-400/10 p-4">
            <div className="mb-3 inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <img src="/square-wordmark.svg" alt="Square" className="h-6 w-auto" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">Limited-time offer</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Start your free 7-day trial</h2>
            <p className="mt-1 text-sm text-slate-300">
              Create your account to begin. Cancel anytime within 7 days and you will not be charged.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Payment</h3>
              <p className="text-xs text-slate-400">
                After creating your account you'll set up your payment method on the Account page via Square's secure checkout.
                No payment is collected now — your 7-day free trial starts immediately.
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1">Credit Card</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1">ACH Bank</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1">Apple Pay</span>
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1">Google Pay</span>
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <input
                type="checkbox"
                checked={form.agreedToAutoRenewal}
                onChange={setField('agreedToAutoRenewal')}
                className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-teal-400 focus:ring-teal-400"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                I agree that my subscription starts with a free 7-day trial and will automatically renew unless I cancel before trial end.
              </span>
            </label>
            {billingError && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{billingError}</p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
            )}
            <button
              type="submit" disabled={loading} aria-busy={loading}
              className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Start free trial'}
            </button>
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
