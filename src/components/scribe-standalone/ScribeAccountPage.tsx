import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CircleCheck, CreditCard, KeyRound, Mail, MessageSquare } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';
import { SquareCardForm } from './SquareCardForm';

interface BillingHistoryEntry {
  id: string;
  paymentMethod: string;
  network?: string | null;
  phone?: string | null;
  createdAt: string;
}

interface BillingMethod {
  id: 'square_card' | 'square_bitcoin';
  label: string;
  type: string;
}

interface BillingOptionsResponse {
  subscription: {
    monthlyPriceUsd: number;
    trialDays: number;
  };
  methods: BillingMethod[];
}

const DEFAULT_BILLING_OPTIONS: BillingOptionsResponse = {
  subscription: { monthlyPriceUsd: 20, trialDays: 7 },
  methods: [
    { id: 'square_card', label: 'Credit Card (Square)', type: 'card' },
    { id: 'square_bitcoin', label: 'Bitcoin via Square (On-chain or Lightning)', type: 'crypto' },
  ],
};

const ACCOUNT_DETAILS_FALLBACK_ERROR = 'Could not load all account details right now. Showing billing defaults while connection recovers.';
const BILLING_HISTORY_ERROR = 'Could not load billing history yet. You can still choose a payment method below.';

const SquareBadge: React.FC = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
    <img src="/square-wordmark.svg" alt="Square" className="h-4 w-auto" />
    <span className="text-xs font-medium text-emerald-200">PCI-compliant checkout</span>
  </div>
);

export const ScribeAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useScribeAuthStore();
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [options, setOptions] = useState<BillingOptionsResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<BillingMethod['id']>('square_card');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<'bitcoin' | 'lightning'>('bitcoin');
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);

  useEffect(() => {
    const load = async () => {
      let hadFailure = false;
      let historyFailed = false;
      let loadError: string | null = null;

      const optionsRes = await fetch(`${getBackendUrl()}/api/scribe/billing/options`, { credentials: 'include' }).catch(() => null);
      if (optionsRes?.ok) {
        const optionsData = (await optionsRes.json()) as BillingOptionsResponse;
        setOptions(optionsData);
        if (optionsData.methods.length > 0) {
          setPaymentMethod(optionsData.methods[0].id);
        }
      } else {
        setOptions(DEFAULT_BILLING_OPTIONS);
        hadFailure = true;
        loadError = ACCOUNT_DETAILS_FALLBACK_ERROR;
      }

      const historyRes = await fetch(`${getBackendUrl()}/api/scribe/billing/history`, { credentials: 'include' }).catch(() => null);
      if (historyRes?.ok) {
        const historyData = await historyRes.json();
        const latest = historyData.entries?.[0] as BillingHistoryEntry | undefined;

        setHistory(historyData.entries || []);
        if (latest?.paymentMethod) {
          setPaymentMethod((latest.paymentMethod === 'bitcoin' ? 'square_bitcoin' : latest.paymentMethod) as BillingMethod['id']);
        }
        if (latest?.phone) {
          setPhone(latest.phone);
        }
      } catch {
        historyFailed = true;
        hadFailure = true;
          hadFailure = true;
        }
      } else {
        historyFailed = true;
        hadFailure = true;
      }

      if (historyFailed) {
        loadError = BILLING_HISTORY_ERROR;
      } else if (hadFailure) {
        loadError = loadError ?? 'Could not load all account details right now.';
      }

      setError(loadError);
    };

    load();
  }, []);

  const latestPreference = history[0];


  const handleBillingUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoadingBilling(true);
    setBillingMessage(null);
    setCheckoutUrl(null);
    setError(null);

    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/checkout-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentMethod,
          phone: phone || undefined,
          network: paymentMethod === 'square_bitcoin' ? network : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Could not update billing preference.');
        return;
      }

      setBillingMessage(data.message || 'Billing preference saved.');
      setCheckoutUrl(data.checkoutUrl || null);
    } finally {
      setLoadingBilling(false);
    }
  };

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
          Manage billing, payment method, password, and your contact information from one place.
        </p>
      </header>

      <div className="grid gap-4">
        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Billing information</h2>
            <SquareBadge />
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CircleCheck size={16} />
            <span>Active plan</span>
          </div>
          <p className="text-sm text-slate-300">
            {options
              ? `$${options.subscription.monthlyPriceUsd}/month after ${options.subscription.trialDays}-day free trial.`
              : 'Loading subscription pricing...'}
          </p>
          <p className="text-xs text-slate-500">
            Need to cancel? You can cancel anytime and your plan remains active through the current billing cycle.
          </p>
          <p className="text-xs text-slate-500">
            Payments are processed through Square secure checkout (embedded card form or hosted checkout link).
          </p>
          <a
            href="mailto:support@docassistai.com?subject=Cancel%20my%20DocAssist%20Scribe%20subscription"
            className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200"
          >
            <AlertTriangle size={14} />
            Cancel subscription
          </a>
        </article>

        <form onSubmit={handleBillingUpdate} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Change billing method</h2>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as BillingMethod['id'])}
              disabled={!options || options.methods.length === 0}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              {(options?.methods ?? []).map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>


          {paymentMethod === 'square_bitcoin' && (
            <div>
              <label className="text-xs uppercase tracking-wide text-slate-400">Bitcoin network</label>
              <select
                value={network}
                onChange={(e) => setNetwork(e.target.value as 'bitcoin' | 'lightning')}
                className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
              >
                <option value="bitcoin">Bitcoin (on-chain)</option>
                <option value="lightning">Lightning</option>
              </select>
            </div>
          )}


          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">SMS phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+14155551234"
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            />
          </div>

          {paymentMethod === 'square_card' && options && options.methods.some((m) => m.id === 'square_card') && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Enter your card details below. Card number, CVV, and expiration are collected in Square's encrypted iframe.
              </p>
              <SquareCardForm
                phone={phone}
                onSuccess={(msg) => {
                  setBillingMessage(msg);
                  setError(null);
                }}
                onError={(msg) => {
                  setError(msg);
                  setBillingMessage(null);
                }}
              />
            </div>
          )}

          <p className="text-sm text-slate-300">
            {latestPreference
              ? `Current preference: ${latestPreference.paymentMethod.replace('_', ' ')}${latestPreference.network ? ` on ${latestPreference.network}` : ''}.`
              : 'No payment method selected yet.'}
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {billingMessage && (
            <div className="text-sm text-emerald-400 space-y-1">
              <p>{billingMessage}</p>
              {checkoutUrl && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-emerald-300 text-xs uppercase tracking-wide">Square checkout ready</p>
                  <a href={checkoutUrl} target="_blank" rel="noreferrer" className="text-teal-300 underline font-medium">
                    Open secure Square checkout
                  </a>
                </div>
              )}
            </div>
          )}

          {paymentMethod !== 'square_card' && !checkoutUrl && !loadingBilling && (
            <p className="text-xs text-amber-300">
              If checkout is unavailable, set <code className="text-amber-200">SQUARE_CHECKOUT_URL</code> and{' '}
              <code className="text-amber-200">SQUARE_BITCOIN_CHECKOUT_URL</code> on the backend.
            </p>
          )}

          <button
            type="submit"
            disabled={loadingBilling || !options}
            className="inline-flex items-center gap-2 bg-teal-400 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            <CreditCard size={14} />
            {loadingBilling ? 'Saving...' : paymentMethod === 'square_card' ? 'Get hosted checkout link' : 'Save billing method'}
          </button>
        </form>

        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Change password</h2>
          <p className="text-sm text-slate-300">For security, use the password reset flow to set a new password.</p>
          <Link to="/scribe/forgot-password" className="inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200">
            <KeyRound size={14} />
            Change password
          </Link>
        </article>

        <article className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Contact information</h2>
          <div className="text-sm text-slate-300 space-y-2">
            <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> Email: {user?.email ?? 'Loading...'}</p>
            <p className="flex items-center gap-2"><MessageSquare size={14} className="text-slate-400" /> SMS: {phone || 'Not set'}</p>
          </div>
          <p className="text-xs text-slate-500">Need to change your account email? Contact support and we can update it securely.</p>
          <a href="mailto:admin@docassistai.app?subject=Update%20my%20DocAssist%20account%20contact%20information" className="inline-flex items-center gap-2 text-sm text-teal-300 hover:text-teal-200">
            Contact support
          </a>
        </article>
      </div>
    </section>
  );
};
