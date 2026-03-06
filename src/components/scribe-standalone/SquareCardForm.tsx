import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import type { SquareCard } from './square-types';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareCardForm: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const cardRef = useRef<SquareCard | null>(null);
  const initAttempted = useRef(false);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) {
          setConfigError(
            'Square card entry is not enabled yet. Configure backend env vars SQUARE_WEB_APP_ID, SQUARE_LOCATION_ID, and SQUARE_ACCESS_TOKEN.',
          );
          return;
        }

        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        setEnvironment(env);

        await ensureSquareSdkLoaded(env);

        if (!window.Square) {
          throw new Error('Square SDK unavailable.');
        }

        const payments = await window.Square.payments(cfg.appId, cfg.locationId);
        const card = await payments.card();
        await card.attach('#square-card-container');
        cardRef.current = card;
        setReady(true);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Unable to initialize Square payments.');
      }
    };

    init();

    return () => {
      if (cardRef.current) {
        cardRef.current.destroy().catch(() => {});
        cardRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!cardRef.current) {
      onError('Square card form is not ready yet.');
      return;
    }

    setLoading(true);
    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Card validation failed.';
        onError(err);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-card-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId: tokenResult.token, phone: phone || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'Payment failed.');
        return;
      }

      onSuccess(data.message || 'Payment processed successfully.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Payment failed.');
    } finally {
      setLoading(false);
    }
  };

  // Show config error only AFTER async init has failed (not as initial state).
  // This prevents the race condition where #square-card-container isn't in the
  // DOM when card.attach() runs, because the early return removed it.
  if (configError) {
    return (
      <p className="text-xs text-amber-300">
        {configError}
      </p>
    );
  }

  // Always render the container div so #square-card-container exists in the DOM
  // when the async useEffect calls card.attach(). Button stays disabled until ready.
  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
        <span>Card details</span>
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-emerald-300"><Lock size={13} />256-bit SSL encryption</span>
          <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
            {environment}
          </span>
        </div>
      </div>
      <div id="square-card-container" className="min-h-20 rounded-lg border border-slate-700 bg-slate-900 p-2" />
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || loading}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
      >
        {loading ? 'Processing payment...' : 'Pay securely with Square'}
      </button>
    </div>
  );
};
