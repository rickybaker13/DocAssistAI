import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocAssistLogo } from './DocAssistLogo';

/**
 * Detects if the app is running as an installed PWA (standalone mode).
 * If so, shows a brief branded splash screen then navigates to sign-in.
 * If not, renders the normal landing page passed as children.
 */
export const PwaSplashGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isPwa, setIsPwa] = useState<boolean | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

    if (!standalone) {
      setIsPwa(false);
      return;
    }

    setIsPwa(true);

    // Show splash briefly, then fade out and navigate to sign-in
    const fadeTimer = setTimeout(() => setFadeOut(true), 1200);
    const navTimer = setTimeout(() => navigate('/scribe/login', { replace: true }), 1800);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  // Still detecting — render nothing to avoid flash
  if (isPwa === null) return null;

  // Not a PWA — show normal landing page
  if (!isPwa) return <>{children}</>;

  // PWA splash screen
  return (
    <div
      className={`fixed inset-0 bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo with scale-in animation */}
      <div className="animate-splash-in flex flex-col items-center">
        <DocAssistLogo className="w-28 h-28 rounded-3xl mb-6 drop-shadow-2xl" />
        <h1 className="text-3xl font-semibold text-slate-50 tracking-tight">DocAssistAI</h1>
        <p className="text-sm text-slate-400 mt-2">Clinical documentation, simplified</p>
      </div>
    </div>
  );
};

export default PwaSplashGate;
