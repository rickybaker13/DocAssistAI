import React, { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import type { SquareConfigResponse } from './square-types';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareAchButton: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const initAttempted = useRef(false);
  const configRef = useRef<SquareConfigResponse | null>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) return;

        configRef.current = cfg;
        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        setEnabled(true);

        await ensureSquareSdkLoaded(env);
        if (!window.Square) throw new Error('Square SDK unavailable.');
        setReady(true);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Unable to initialize ACH payments.');
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!window.Square || !configRef.current) {
      onError('Square SDK is not ready.');
      return;
    }

    setLoading(true);
    try {
      const payments = await window.Square.payments(configRef.current.appId!, configRef.current.locationId!);
      const ach = await payments.ach();
      const tokenResult = await ach.tokenize({
        accountHolderName: 'Account Holder',
        intent: 'CHARGE',
        total: { amount: 2000, currencyCode: 'USD' },
      });

      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Bank authentication failed.';
        onError(err);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId: tokenResult.token, phone: phone || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'ACH payment failed.');
        return;
      }

      onSuccess(data.message || 'Bank payment processed successfully.');
    } catch (error) {
      if ((error as any)?.message?.includes('cancelled')) return; // user closed Plaid modal
      onError(error instanceof Error ? error.message : 'ACH payment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) {
    return <p className="text-xs text-amber-300">Square ACH payments are not configured yet.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <p className="text-xs text-slate-400">
        Click below to securely link your bank account via Plaid. Funds are debited directly — no card needed.
      </p>
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || loading}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Building2 size={16} />
        {loading ? 'Connecting to bank...' : 'Pay with bank account'}
      </button>
    </div>
  );
};
