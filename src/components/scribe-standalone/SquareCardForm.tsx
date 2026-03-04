import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => {
        card: () => Promise<{
          attach: (selector: string) => Promise<void>;
          tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>;
        }>;
      };
    };
  }
}

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface SquareConfigResponse {
  appId: string | null;
  locationId: string | null;
  environment?: 'sandbox' | 'production';
  enabled: boolean;
}

const SQUARE_SDK_SELECTOR = 'script[data-square-sdk="true"]';

const ensureSquareSdkLoaded = async (): Promise<void> => {
  if (window.Square) {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(SQUARE_SDK_SELECTOR);

  if (existingScript) {
    await new Promise<void>((resolve, reject) => {
      if (window.Square) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Square SDK.')), { once: true });
    });

    return;
  }

  const script = document.createElement('script');
  script.src = 'https://web.squarecdn.com/v1/square.js';
  script.async = true;
  script.dataset.squareSdk = 'true';
  document.body.appendChild(script);

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK.'));
  });
};

export const SquareCardForm: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const cardRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }> } | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const cfgRes = await fetch(`${getBackendUrl()}/api/scribe/billing/square-config`, { credentials: 'include' });
        const cfg = (await cfgRes.json()) as SquareConfigResponse;
        if (!cfgRes.ok || !cfg.enabled || !cfg.appId || !cfg.locationId) {
          return;
        }

        setEnvironment(cfg.environment === 'production' ? 'production' : 'sandbox');
        setEnabled(true);

        await ensureSquareSdkLoaded();

        if (!window.Square) {
          throw new Error('Square SDK unavailable.');
        }

        const payments = window.Square.payments(cfg.appId, cfg.locationId);
        const card = await payments.card();
        await card.attach('#square-card-container');
        cardRef.current = card;

        if (mounted) {
          setReady(true);
        }
      } catch (error) {
        if (mounted) {
          onError(error instanceof Error ? error.message : 'Unable to initialize Square payments.');
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [onError]);

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

  if (!enabled) {
    return (
      <p className="text-xs text-amber-300">
        Square card entry is not enabled yet. Configure <code className="text-amber-200">SQUARE_WEB_APP_ID</code>,{' '}
        <code className="text-amber-200">SQUARE_LOCATION_ID</code>, and <code className="text-amber-200">SQUARE_ACCESS_TOKEN</code>.
      </p>
    );
  }

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
