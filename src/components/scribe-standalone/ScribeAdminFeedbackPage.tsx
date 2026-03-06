import React, { useState, useEffect } from 'react';
import { Shield, Bug, Lightbulb, MessageCircle, Heart, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Navigate } from 'react-router-dom';

interface FeedbackItem {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  category: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: 'bug', label: 'Bug', icon: Bug, color: 'text-red-400 bg-red-950 border-red-400/30' },
  { value: 'feature_request', label: 'Feature', icon: Lightbulb, color: 'text-blue-400 bg-blue-950 border-blue-400/30' },
  { value: 'general', label: 'General', icon: MessageCircle, color: 'text-slate-400 bg-slate-800 border-slate-600/30' },
  { value: 'praise', label: 'Praise', icon: Heart, color: 'text-emerald-400 bg-emerald-950 border-emerald-400/30' },
];

const STATUS_BADGES: Record<string, string> = {
  new: 'text-amber-400 bg-amber-950 border-amber-400/30',
  read: 'text-blue-400 bg-blue-950 border-blue-400/30',
  resolved: 'text-emerald-400 bg-emerald-950 border-emerald-400/30',
};

export const ScribeAdminFeedbackPage: React.FC = () => {
  const user = useScribeAuthStore(s => s.user);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect non-admins
  if (user && !user.is_admin) return <Navigate to="/scribe/dashboard" replace />;

  const fetchItems = async () => {
    const params = new URLSearchParams();
    if (filterCategory) params.set('category', filterCategory);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/admin?${params}`, { credentials: 'include' });
      if (res.ok) setItems(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchItems(); }, [filterCategory, filterStatus]);

  const handleUpdate = async (id: string, status: string, adminNote: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/feedback/admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, admin_note: adminNote }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const getCategoryMeta = (cat: string) => CATEGORIES.find(c => c.value === cat) ?? CATEGORIES[2];

  const selectClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
          <Shield size={22} className="text-teal-400" />
          Admin — Feedback
        </h1>
        <p className="text-sm text-slate-400 mt-1">{items.length} submissions</p>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={selectClass}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="read">Read</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* ── List ───────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">No feedback found.</p>
        )}
        {items.map(item => {
          const meta = getCategoryMeta(item.category);
          const Icon = meta.icon;
          const expanded = expandedId === item.id;
          return (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : item.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${meta.color}`}>
                  <Icon size={12} />
                  {meta.label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{item.message}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{item.user_email}</span>
                    <span className="text-xs text-slate-600">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium border shrink-0 ${STATUS_BADGES[item.status] ?? STATUS_BADGES.new}`}>
                  {item.status}
                </span>
                {expanded ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>

              {expanded && (
                <ExpandedRow item={item} onSave={handleUpdate} saving={saving} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Expanded row (inline component) ─────────────────────────────────────
const ExpandedRow: React.FC<{
  item: FeedbackItem;
  onSave: (id: string, status: string, adminNote: string) => Promise<void>;
  saving: boolean;
}> = ({ item, onSave, saving }) => {
  const [status, setStatus] = useState(item.status);
  const [adminNote, setAdminNote] = useState(item.admin_note ?? '');

  return (
    <div className="border-t border-slate-800 p-4 space-y-4 bg-slate-950/50">
      <div>
        <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Full message</label>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{item.message}</p>
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            <option value="new">New</option>
            <option value="read">Read</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Admin note</label>
          <textarea
            value={adminNote}
            onChange={e => setAdminNote(e.target.value)}
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            placeholder="Internal notes..."
          />
        </div>
      </div>
      <button
        onClick={() => onSave(item.id, status, adminNote)}
        disabled={saving}
        className="flex items-center gap-1.5 px-4 py-2 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-300 disabled:opacity-50 transition-colors text-sm"
      >
        <Save size={14} />
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
};
