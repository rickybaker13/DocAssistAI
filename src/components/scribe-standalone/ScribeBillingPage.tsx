import React, { useEffect, useState } from 'react';
import { getBackendUrl } from '../../config/appConfig';
import { SquareCardForm } from './SquareCardForm';

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

const SquareBadge: React.FC = () => (
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
    <img src="/square-wordmark.svg" alt="Square" className="h-4 w-auto" />
    <span className="text-xs font-medium text-emerald-200">PCI-compliant checkout</span>
  </div>
);

export const ScribeBillingPage: React.FC = () => {
  const [options, setOptions] = useState<BillingOptionsResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<BillingMethod['id']>('square_card');
  const [phone, setPhone] = useState('');
  const [network, setNetwork] = useState<'bitcoin' | 'lightning'>('bitcoin');
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/options`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to load billing options.');
        return;
      }
      setOptions(data);
    };
    load();
  }, []);


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setCheckoutUrl(null);

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
        setError(data.error || 'Could not create checkout request.');
      } else {
        setMessage(data.message || 'Saved.');
        setCheckoutUrl(data.checkoutUrl);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!options) {
    return <div className="text-slate-300">Loading billing options...</div>;
  }

  return (
    <section className="space-y-6">
      <header className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-100">Billing & Subscriptions</h1>
          <SquareBadge />
        </div>
        <p className="text-sm text-slate-400 mt-2">
          ${options.subscription.monthlyPriceUsd}/month with a {options.subscription.trialDays}-day free trial.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          You&apos;ll be redirected to an official Square-hosted checkout page to complete payment securely.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">Payment method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as BillingMethod['id'])}
            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
          >
            {options.methods.map((method) => (
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
          <label className="text-xs uppercase tracking-wide text-slate-400">Mobile number for SMS updates (optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+14155551234"
            className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
          />
        </div>

        {paymentMethod === 'square_card' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              Enter your card details below. Card data is encrypted by Square and never touches our frontend.
            </p>
            <SquareCardForm
              phone={phone}
              onSuccess={(msg) => {
                setMessage(msg);
                setError(null);
                setCheckoutUrl(null);
              }}
              onError={(msg) => {
                setError(msg);
                setMessage(null);
              }}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && (
          <div className="text-sm text-emerald-400 space-y-1">
            <p>{message}</p>
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

        {paymentMethod !== 'square_card' && !checkoutUrl && !loading && (
          <p className="text-xs text-amber-300">
            If checkout does not open, configure <code className="text-amber-200">SQUARE_CHECKOUT_URL</code> and{' '}
            <code className="text-amber-200">SQUARE_BITCOIN_CHECKOUT_URL</code> in backend environment variables.
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-teal-400 text-slate-900 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
        >
          {loading ? 'Preparing checkout...' : paymentMethod === 'square_card' ? 'Get hosted checkout link instead' : 'Continue to payment'}
        </button>
      </form>
    </section>
  );
};
