import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CircleCheck, Clock, CreditCard, KeyRound, Mail, MessageSquare, XCircle } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';
import { SquareCardForm } from './SquareCardForm';
import { SquareAchButton } from './SquareAchButton';
import { SquareApplePayButton } from './SquareApplePayButton';
import { SquareGooglePayButton } from './SquareGooglePayButton';

interface SubscriptionStatus {
  subscription_status: 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  period_ends_at: string | null;
  cancelled_at: string | null;
}

interface BillingHistoryEntry {
  id: string;
  payment_method: string;
  network?: string | null;
  phone?: string | null;
  created_at: string;
}

interface BillingMethod {
  id: 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay';
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
    { id: 'square_ach', label: 'Bank account (ACH via Square)', type: 'bank' },
    { id: 'square_apple_pay', label: 'Apple Pay (Square)', type: 'wallet' },
    { id: 'square_google_pay', label: 'Google Pay (Square)', type: 'wallet' },
  ],
};

const ACCOUNT_DETAILS_FALLBACK_ERROR = 'Could not load all account details right now. Showing billing defaults while connection recovers.';
const BILLING_HISTORY_ERROR = 'Could not load billing history yet. You can still choose a payment method below.';

const SquareBadge: React.FC = () => (
  <div className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
    <img src="/square-wordmark.svg" alt="Square" className="h-6 w-auto" />
    <span className="text-sm font-medium text-emerald-200">PCI-compliant checkout</span>
  </div>
);

export const ScribeAccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useScribeAuthStore();
  const [history, setHistory] = useState<BillingHistoryEntry[]>([]);
  const [options, setOptions] = useState<BillingOptionsResponse>(DEFAULT_BILLING_OPTIONS);
  const [paymentMethod, setPaymentMethod] = useState<BillingMethod['id']>('square_card');
  const [phone, setPhone] = useState('');
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      let hadFailure = false;
      let historyFailed = false;
      let loadError: string | null = null;

      const optionsData = await fetchJsonOrNull<BillingOptionsResponse>(`${getBackendUrl()}/api/scribe/billing/options`);
      if (optionsData) {
        setOptions(optionsData);
        if (optionsData.methods.length > 0) {
          setPaymentMethod(optionsData.methods[0].id);
        }
      } else {
        setOptions(DEFAULT_BILLING_OPTIONS);
        hadFailure = true;
        loadError = ACCOUNT_DETAILS_FALLBACK_ERROR;
      }

      const historyData = await fetchJsonOrNull<{ entries?: BillingHistoryEntry[] }>(`${getBackendUrl()}/api/scribe/billing/history`);
      if (historyData) {
        const latest = historyData.entries?.[0] as BillingHistoryEntry | undefined;

        setHistory(historyData.entries || []);
        if (latest?.payment_method) {
          setPaymentMethod(latest.payment_method as BillingMethod['id']);
        }
        if (latest?.phone) {
          setPhone(latest.phone);
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

      // Fetch subscription status
      const statusData = await fetchJsonOrNull<SubscriptionStatus>(`${getBackendUrl()}/api/scribe/billing/status`);
      if (statusData) {
        setSubStatus(statusData);
      }
    };

    load();
  }, []);

  const latestPreference = history[0];

  const formatDate = (iso: string | null) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    setCancelMessage(null);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not cancel subscription.');
        return;
      }
      setCancelMessage(data.message || 'Subscription cancelled.');
      setShowCancelConfirm(false);
      // Refresh subscription status
      const statusData = await fetchJsonOrNull<SubscriptionStatus>(`${getBackendUrl()}/api/scribe/billing/status`);
      if (statusData) setSubStatus(statusData);
    } catch {
      setError('Could not cancel subscription. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

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

          {/* Subscription status badge */}
          {subStatus?.subscription_status === 'active' && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CircleCheck size={16} />
              <span>Active plan</span>
              {subStatus.period_ends_at && (
                <span className="text-xs text-slate-400 ml-1">
                  — renews {formatDate(subStatus.period_ends_at)}
                </span>
              )}
            </div>
          )}
          {subStatus?.subscription_status === 'trialing' && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <Clock size={16} />
              <span>Free trial</span>
              {subStatus.trial_ends_at && (
                <span className="text-xs text-slate-400 ml-1">
                  — ends {formatDate(subStatus.trial_ends_at)}
                </span>
              )}
            </div>
          )}
          {subStatus?.subscription_status === 'cancelled' && (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <XCircle size={16} />
              <span>Cancelled</span>
              {subStatus.period_ends_at && (
                <span className="text-xs text-slate-400 ml-1">
                  — access until {formatDate(subStatus.period_ends_at)}
                </span>
              )}
            </div>
          )}
          {subStatus?.subscription_status === 'expired' && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <XCircle size={16} />
              <span>Expired</span>
            </div>
          )}
          {!subStatus && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CircleCheck size={16} />
              <span>Active plan</span>
            </div>
          )}

          <p className="text-sm text-slate-300">
            {`$${options.subscription.monthlyPriceUsd}/month after ${options.subscription.trialDays}-day free trial.`}
          </p>
          <p className="text-xs text-slate-500">
            Payments are processed through Square secure checkout (embedded card form or hosted checkout link).
          </p>

          {/* Cancel message */}
          {cancelMessage && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-200">{cancelMessage}</p>
            </div>
          )}

          {/* Cancelled state — show access-until info */}
          {subStatus?.subscription_status === 'cancelled' && !cancelMessage && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-200">
                Your subscription has been cancelled. You have full access until{' '}
                <strong>{formatDate(subStatus.period_ends_at)}</strong>.
              </p>
            </div>
          )}

          {/* Cancel button — only show for active or trialing */}
          {(subStatus?.subscription_status === 'active' || subStatus?.subscription_status === 'trialing') && !showCancelConfirm && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="inline-flex items-center gap-2 text-sm text-red-300 hover:text-red-200 transition-colors"
            >
              <AlertTriangle size={14} />
              Cancel subscription
            </button>
          )}

          {/* Cancel confirmation dialog */}
          {showCancelConfirm && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-3">
              <p className="text-sm text-red-200 font-medium">Are you sure you want to cancel?</p>
              <p className="text-xs text-slate-300">
                {subStatus?.subscription_status === 'active' && subStatus.period_ends_at
                  ? `You'll keep full access until ${formatDate(subStatus.period_ends_at)}. After that, your subscription will not renew.`
                  : subStatus?.subscription_status === 'trialing' && subStatus.trial_ends_at
                    ? `You'll keep access until your trial ends on ${formatDate(subStatus.trial_ends_at)}.`
                    : 'Your subscription will be cancelled immediately.'}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {cancelLoading ? 'Cancelling...' : 'Yes, cancel my subscription'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Keep my subscription
                </button>
              </div>
            </div>
          )}

          {/* No cancel button needed — already cancelled or expired */}
          {!subStatus && (
            <p className="text-xs text-slate-500">
              Need to cancel? You can cancel anytime and your plan remains active through the current billing cycle.
            </p>
          )}
        </article>

        <form onSubmit={handleBillingUpdate} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Change billing method</h2>
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-400">Payment method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as BillingMethod['id'])}
              disabled={options.methods.length === 0}
              className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              {options.methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>


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

          {paymentMethod === 'square_card' && options.methods.some((m) => m.id === 'square_card') && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                Enter your card details below. Card number, CVV, and expiration are collected in Square's encrypted iframe.
              </p>
              <p className="text-xs text-emerald-300">Use this form to update the credit card on file.</p>
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

          {paymentMethod === 'square_ach' && (
            <SquareAchButton
              phone={phone}
              onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
              onError={(msg) => { setError(msg); setBillingMessage(null); }}
            />
          )}

          {paymentMethod === 'square_apple_pay' && (
            <SquareApplePayButton
              phone={phone}
              onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
              onError={(msg) => { setError(msg); setBillingMessage(null); }}
            />
          )}

          {paymentMethod === 'square_google_pay' && (
            <SquareGooglePayButton
              phone={phone}
              onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
              onError={(msg) => { setError(msg); setBillingMessage(null); }}
            />
          )}

          <p className="text-sm text-slate-300">
            {latestPreference
              ? `Current preference: ${latestPreference.payment_method.replace('_', ' ')}.`
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
              If checkout is unavailable, set <code className="text-amber-200">SQUARE_ACH_CHECKOUT_URL</code>,{' '}
              <code className="text-amber-200">SQUARE_APPLE_PAY_CHECKOUT_URL</code>,{' '}
              <code className="text-amber-200">SQUARE_GOOGLE_PAY_CHECKOUT_URL</code> on the backend.
            </p>
          )}

          <button
            type="submit"
            disabled={loadingBilling}
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


const fetchJsonOrNull = async <T,>(url: string): Promise<T | null> => {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
};
