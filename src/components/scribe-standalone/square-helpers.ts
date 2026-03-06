import { getBackendUrl } from '../../config/appConfig';
import type { SquareConfigResponse } from './square-types';

const SQUARE_SDK_SELECTOR = 'script[data-square-sdk="true"]';

const getSquareSdkUrl = (environment: 'sandbox' | 'production'): string => (
  environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'
);

export const ensureSquareSdkLoaded = async (environment: 'sandbox' | 'production'): Promise<void> => {
  const desiredSdkUrl = getSquareSdkUrl(environment);

  if (window.Square) return;

  const existingScript = document.querySelector<HTMLScriptElement>(SQUARE_SDK_SELECTOR);

  if (existingScript) {
    if (existingScript.src !== desiredSdkUrl) {
      existingScript.remove();
    } else {
      await new Promise<void>((resolve, reject) => {
        if (window.Square) { resolve(); return; }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Square SDK.')), { once: true });
      });
      return;
    }
  }

  const script = document.createElement('script');
  script.src = desiredSdkUrl;
  script.async = true;
  script.dataset.squareSdk = 'true';
  document.body.appendChild(script);

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK.'));
  });
};

export const fetchSquareConfig = async (): Promise<SquareConfigResponse | null> => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-config`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as SquareConfigResponse;
  } catch {
    return null;
  }
};
