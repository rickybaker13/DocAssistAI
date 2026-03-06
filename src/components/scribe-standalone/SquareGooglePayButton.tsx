import React, { useEffect, useRef, useState } from 'react';
import { getBackendUrl } from '../../config/appConfig';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';
import type { SquareDigitalWallet } from './square-types';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareGooglePayButton: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const initAttempted = useRef(false);
  const walletRef = useRef<SquareDigitalWallet | null>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) { setSupported(false); return; }

        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        await ensureSquareSdkLoaded(env);
        if (!window.Square) { setSupported(false); return; }

        const payments = await window.Square.payments(cfg.appId, cfg.locationId);
        const paymentRequest = {
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: '20.00', label: 'DocAssist Scribe' },
        };

        try {
          const googlePay = await payments.googlePay(paymentRequest);
          await googlePay.attach('#google-pay-button');
          walletRef.current = googlePay;
          setSupported(true);
        } catch {
          setSupported(false);
        }
      } catch {
        setSupported(false);
      }
    };

    init();

    return () => {
      if (walletRef.current) {
        walletRef.current.destroy().catch(() => {});
        walletRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!walletRef.current) { onError('Google Pay is not ready.'); return; }

    setLoading(true);
    try {
      const tokenResult = await walletRef.current.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Google Pay authorization failed.';
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
      if (!res.ok) { onError(data.error || 'Google Pay payment failed.'); return; }

      onSuccess(data.message || 'Google Pay payment processed successfully.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Google Pay payment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (supported === null) {
    return <p className="text-xs text-slate-500">Checking Google Pay availability...</p>;
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-xs text-amber-300">
          Google Pay is not available in this browser. Try using Chrome, or select a different payment method.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <p className="text-xs text-slate-400">
        Complete your payment securely with Google Pay.
      </p>
      <div id="google-pay-button" className="min-h-12" onClick={handlePay} />
      {loading && <p className="text-xs text-slate-400">Processing Google Pay...</p>}
    </div>
  );
};
