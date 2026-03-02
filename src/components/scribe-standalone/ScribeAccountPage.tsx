import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Settings, AlertTriangle, CircleCheck } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';

interface BillingHistoryEntry {
  id: string;
  paymentMethod: string;
  network?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface BillingOptionsResponse {
  subscription: {
    monthlyPriceUsd: number;
    trialDays: number;
  };
}

export const ScribeAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useScribeAuthStore();
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [options, setOptions] = useState<BillingOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [historyRes, optionsRes] = await Promise.all([
          fetch(`${getBackendUrl()}/api/scribe/billing/history`, { credentials: 'include' }),
          fetch(`${getBackendUrl()}/api/scribe/billing/options`, { credentials: 'include' }),
        ]);

        if (!historyRes.ok || !optionsRes.ok) {
          throw new Error('Unable to load account details.');
        }

        const historyData = await historyRes.json();
        const optionsData = await optionsRes.json();
        setHistory(historyData.entries || []);
        setOptions(optionsData);
      } catch {
        setError('Could not load all account details right now.');
      }
    };

    load();
  }, []);

  const latestPreference = history[0];

  return (
    <section className="space-y-5">
      <button
        onClick={() => navigate('/scribe/dashboard')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </button>

      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
        <h1 className="text-xl font-semibold text-slate-100">Account</h1>
        <p className="text-sm text-slate-400">
          Manage your subscription, billing preferences, payment method, and profile settings.
        </p>
      </header>

      <div className="grid gap-4">
        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Subscription</h2>
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CircleCheck size={16} />
            <span>Active plan</span>
          </div>
          <p className="text-sm text-slate-300">
            {options ? `$${options.subscription.monthlyPriceUsd}/month after ${options.subscription.trialDays}-day free trial.` : 'Loading subscription pricing...'}
          </p>
          <p className="text-xs text-slate-500">
            Need to cancel? You can cancel anytime and your plan remains active through the current billing cycle.
          </p>
          <a
            href="mailto:support@docassistai.com?subject=Cancel%20my%20DocAssist%20Scribe%20subscription"
            className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
          >
            <AlertTriangle size={14} />
            Cancel subscription
          </a>
        </article>

        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Payment method</h2>
          <p className="text-sm text-slate-300">
            {latestPreference
              ? `Current preference: ${latestPreference.paymentMethod.replace('_', ' ')}${latestPreference.network ? ` on ${latestPreference.network}` : ''}.`
              : 'No payment method selected yet.'}
          </p>
          <Link to="/scribe/billing" className="inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200">
            <CreditCard size={14} />
            Update payment method
          </Link>
        </article>

        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Profile</h2>
          <p className="text-sm text-slate-300">Signed in as {user?.email ?? 'Loading user…'}</p>
          <Link to="/scribe/settings" className="inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200">
            <Settings size={14} />
            Edit profile settings
          </Link>
        </article>

        {error && <p className="text-sm text-amber-300">{error}</p>}
      </div>
    </section>
  );
};
