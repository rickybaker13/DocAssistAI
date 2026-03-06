import React, { useState } from 'react';
import { Download, Smartphone, Share2, PlusSquare, CheckCircle2, X } from 'lucide-react';
import { usePwaInstall } from '../../hooks/usePwaInstall';

export const InstallMobileAppCard: React.FC = () => {
  const { canInstall, isInstalled, needsIosInstructions, promptInstall } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleInstall = async () => {
    setStatusMessage(null);

    if (isInstalled) {
      setStatusMessage('App is already installed on this device.');
      return;
    }

    if (canInstall) {
      const outcome = await promptInstall();

      if (outcome === 'accepted') {
        setStatusMessage('Install started. Look for the app icon on your home screen.');
      } else if (outcome === 'dismissed') {
        setStatusMessage('Install prompt dismissed. You can try again anytime.');
      }

      return;
    }

    if (needsIosInstructions) {
      setShowIosModal(true);
      return;
    }

    setStatusMessage('Install is not available yet. Use a supported mobile browser and try again.');
  };

  return (
    <>
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 rounded-xl border border-slate-700">
            <Smartphone size={18} className="text-teal-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-50">Install on mobile</h2>
            <p className="text-sm text-slate-400">
              Add DocAssistAI to your phone home screen for an app-like experience.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleInstall}
          className="w-full inline-flex items-center justify-center gap-2 bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 transition-colors"
        >
          {isInstalled ? <CheckCircle2 size={16} /> : <Download size={16} />}
          {isInstalled ? 'Mobile app installed' : 'Download the Mobile App'}
        </button>

        {statusMessage && (
          <p className="text-xs text-slate-300 bg-slate-900 border border-slate-700 rounded-lg p-2.5">{statusMessage}</p>
        )}
      </div>

      {showIosModal && (
        <div className="fixed inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-50">Install on iPhone/iPad</h3>
                <p className="text-sm text-slate-400 mt-1">Safari requires a manual step for installation.</p>
              </div>
              <button
                type="button"
                aria-label="Close install instructions"
                onClick={() => setShowIosModal(false)}
                className="text-slate-400 hover:text-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <ol className="space-y-2.5 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <Share2 size={15} className="text-teal-400" />
                Tap the <span className="font-medium text-slate-100">Share</span> button in Safari.
              </li>
              <li className="flex items-center gap-2">
                <PlusSquare size={15} className="text-teal-400" />
                Choose <span className="font-medium text-slate-100">Add to Home Screen</span>.
              </li>
              <li>
                Confirm, then launch DocAssistAI from your home screen like a native app.
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIosModal(false)}
              className="w-full bg-slate-800 text-slate-200 rounded-lg py-2 text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

