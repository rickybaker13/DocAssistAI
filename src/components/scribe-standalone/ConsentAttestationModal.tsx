import React, { useState } from 'react';
import { Shield } from 'lucide-react';

/** Current TOS version — bump this when TOS content changes to re-trigger acceptance. */
export const CURRENT_TOS_VERSION = '2026-03-03';

interface ConsentAttestationModalProps {
  onAccept: (tosVersion: string) => Promise<void>;
}

export const ConsentAttestationModal: React.FC<ConsentAttestationModalProps> = ({ onAccept }) => {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAccept(CURRENT_TOS_VERSION);
    } catch {
      setError('Could not save your acceptance. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-8 space-y-5">
        {/* Icon + header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-400/10 border border-teal-400/30 rounded-2xl">
            <Shield size={28} className="text-teal-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-50">Review our policies</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Before continuing, please review and accept our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* Links to legal pages */}
        <div className="flex flex-col gap-2">
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-teal-300 hover:bg-slate-750 hover:border-teal-400/30 transition-colors"
          >
            <span>Terms of Service</span>
            <span className="text-slate-500 text-xs">Opens in new tab &rarr;</span>
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-teal-300 hover:bg-slate-750 hover:border-teal-400/30 transition-colors"
          >
            <span>Privacy Policy</span>
            <span className="text-slate-500 text-xs">Opens in new tab &rarr;</span>
          </a>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-500 bg-slate-900 text-teal-400 focus:ring-teal-400"
          />
          <span className="text-sm text-slate-300 leading-relaxed">
            I have read and agree to the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">
              Terms of Service
            </a>{' '}
            and the{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-teal-400 underline">
              Privacy Policy
            </a>
          </span>
        </label>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">{error}</p>
        )}

        {/* Continue button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreed || submitting}
          className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};
