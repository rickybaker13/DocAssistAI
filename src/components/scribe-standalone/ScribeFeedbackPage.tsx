import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Bug, Lightbulb, MessageCircle, Heart, CheckCircle2 } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  status: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-400 bg-red-950 border-red-400/30' },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-blue-400 bg-blue-950 border-blue-400/30' },
  { value: 'general', label: 'General Feedback', icon: MessageCircle, color: 'text-slate-400 bg-slate-800 border-slate-600/30' },
  { value: 'praise', label: 'Praise', icon: Heart, color: 'text-emerald-400 bg-emerald-950 border-emerald-400/30' },
];

const STATUS_BADGES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-950 border-amber-400/30',
  read: 'text-blue-400 bg-blue-950 border-blue-400/30',
  resolved: 'text-emerald-400 bg-emerald-950 border-emerald-400/30',
};

export const ScribeFeedbackPage: React.FC = () => {
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedbackItem[]>([]);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/mine`, { credentials: 'include' });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit');
      } else {
        setSuccess(true);
        setMessage('');
        fetchItems();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('Unable to reach server.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
          <MessageSquare size={22} className="text-teal-400" />
          Feedback
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Help us improve DocAssistAI. Report bugs, request features, or tell us what you love.
        </p>
      </div>

      {/* ── Submit form ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const selected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    selected
                      ? cat.color
                      : 'text-slate-500 bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <Icon size={14} />
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="feedback-message" className="block text-sm font-medium text-slate-300 mb-2">
            Your feedback
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Tell us what's on your mind..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none text-sm"
          />
          <div className="text-xs text-slate-500 mt-1 text-right">{message.length}/5000</div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={16} />
            Thank you! Your feedback has been submitted.
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !message.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-300 disabled:opacity-50 transition-colors text-sm"
        >
          <Send size={16} />
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </form>

      {/* ── Past submissions ────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">Your Submissions</h2>
          <div className="space-y-2">
            {items.map(item => {
              const meta = getCategoryMeta(item.category);
              const Icon = meta.icon;
              return (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${meta.color}`}>
                    <Icon size={12} />
                    {meta.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 line-clamp-2">{item.message}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${STATUS_BADGES[item.status] ?? STATUS_BADGES.new}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
