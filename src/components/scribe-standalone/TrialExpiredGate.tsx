import React, { useState, useEffect } from 'react';
import { Clock, ChevronDown, MessageSquare, Send, CheckCircle } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

const EXIT_REASONS = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'did_not_work_well', label: 'Did not work well for my workflow' },
  { value: 'did_not_use_it', label: 'Did not use it enough' },
  { value: 'switched_to_another_product', label: 'Switched to another product' },
  { value: 'other', label: 'Other' },
] as const;

interface TrialExpiredGateProps {
  onContinue: () => void;
}

export const TrialExpiredGate: React.FC<TrialExpiredGateProps> = ({ onContinue }) => {
  const [showSurvey, setShowSurvey] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already submitted an exit survey
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getBackendUrl()}/api/scribe/exit-survey/mine`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.submitted) setAlreadySubmitted(true);
        }
      } catch {
        // Ignore — non-critical
      }
    })();
  }, []);

  const handleSubmitSurvey = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/exit-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason: selectedReason,
          suggestion: suggestion.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-800 to-slate-900 p-6 space-y-5">
      {/* Value proposition header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-400/10 border border-teal-400/20">
          <Clock size={28} className="text-teal-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-50">Your free trial has ended</h2>
        <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
          During your trial, DocAssistAI helped you document patient encounters in seconds instead of minutes.
          Think about the hours you saved on charting — time you spent with patients or got back for yourself.
        </p>
      </div>

      {/* CTA to continue */}
      <div className="text-center space-y-3">
        <button
          onClick={onContinue}
          className="w-full max-w-xs mx-auto bg-teal-400 text-slate-900 rounded-xl py-3 px-6 text-sm font-semibold hover:bg-teal-300 transition-colors"
        >
          Continue with DocAssistAI
        </button>
        <p className="text-xs text-slate-500">Plans start at $20/month or $200/year. Cancel anytime.</p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      {/* Not right now toggle */}
      {!showSurvey && !submitted && !alreadySubmitted && (
        <button
          onClick={() => setShowSurvey(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300 transition-colors py-2"
        >
          Not right now
          <ChevronDown size={14} />
        </button>
      )}

      {/* Already submitted state */}
      {alreadySubmitted && !submitted && (
        <div className="rounded-xl bg-slate-800 border border-slate-700 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-teal-400 mb-2">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Thank you for your feedback</span>
          </div>
          <p className="text-xs text-slate-400">
            You've already shared your thoughts with us. We appreciate it!
          </p>
        </div>
      )}

      {/* Exit survey */}
      {showSurvey && !submitted && !alreadySubmitted && (
        <div className="rounded-xl bg-slate-800/50 border border-slate-700 p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-300">
            <MessageSquare size={16} className="text-slate-400" />
            <h3 className="text-sm font-medium">We'd love to know why</h3>
          </div>

          <div className="space-y-2">
            {EXIT_REASONS.map((reason) => (
              <label
                key={reason.value}
                className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition-colors ${
                  selectedReason === reason.value
                    ? 'border-teal-400/50 bg-teal-400/10 text-slate-100'
                    : 'border-slate-700 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                }`}
              >
                <input
                  type="radio"
                  name="exit-reason"
                  value={reason.value}
                  checked={selectedReason === reason.value}
                  onChange={() => setSelectedReason(reason.value)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedReason === reason.value
                      ? 'border-teal-400'
                      : 'border-slate-500'
                  }`}
                >
                  {selectedReason === reason.value && (
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                  )}
                </div>
                {reason.label}
              </label>
            ))}
          </div>

          {/* Suggestion text area */}
          <div>
            <label htmlFor="exit-suggestion" className="block text-xs text-slate-400 mb-1.5">
              Any suggestions for improvement? (optional)
            </label>
            <textarea
              id="exit-suggestion"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Tell us how we can make DocAssistAI better..."
              maxLength={2000}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmitSurvey}
              disabled={!selectedReason || submitting}
              className="inline-flex items-center gap-2 bg-slate-700 text-slate-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
              {submitting ? 'Submitting...' : 'Submit feedback'}
            </button>
            <button
              onClick={() => setShowSurvey(false)}
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Thank you message after submission */}
      {submitted && (
        <div className="rounded-xl bg-teal-400/10 border border-teal-400/20 p-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-teal-400">
            <CheckCircle size={18} />
            <span className="text-sm font-medium">Thank you for your feedback!</span>
          </div>
          <p className="text-xs text-slate-400">
            Your input helps us build a better product. If you change your mind, you can subscribe anytime.
          </p>
        </div>
      )}
    </div>
  );
};
