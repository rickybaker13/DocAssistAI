import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';
import { DISCIPLINE_OPTIONS } from '../../lib/disciplines';
import { InstallMobileAppCard } from './InstallMobileAppCard';

export const ScribeSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, fetchMe } = useScribeAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [specialty, setSpecialty] = useState(user?.specialty ?? '');
  const [billingCodesEnabled, setBillingCodesEnabled] = useState(user?.billing_codes_enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync fields if user loads asynchronously
  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setSpecialty(user.specialty ?? '');
      setBillingCodesEnabled(user.billing_codes_enabled ?? false);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/auth/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          specialty: specialty || null,
          billing_codes_enabled: billingCodesEnabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // Refresh user in store
      await fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-sm flex flex-col gap-5">
      {/* Back button */}
      <button
        onClick={() => navigate('/scribe/dashboard')}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors self-start"
      >
        <ArrowLeft size={16} />
        Back to dashboard
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-800 rounded-xl border border-slate-700">
          <Settings size={20} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-50 tracking-tight">Settings</h1>
          <p className="text-xs text-slate-400">Profile &amp; preferences</p>
        </div>
      </div>

      {/* Card */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Display Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors"
            />
          </div>

          {/* Discipline */}
          <div>
            <label htmlFor="specialty" className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Discipline
            </label>
            <select
              id="specialty"
              value={specialty}
              onChange={e => setSpecialty(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors appearance-none"
            >
              <option value="">Select discipline…</option>
              {DISCIPLINE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Used to filter the section library to sections relevant to your role.
            </p>
          </div>

          {/* Billing Code Suggestions */}
          <div className="pt-4 border-t border-slate-700">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Billing Code Suggestions
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Auto-suggest ICD-10 and CPT codes after note finalization
                </span>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={billingCodesEnabled}
                  onChange={e => setBillingCodesEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-checked:bg-teal-400 rounded-full transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-slate-300 peer-checked:bg-slate-900 peer-checked:translate-x-5 rounded-full transition-all" />
              </div>
            </label>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-950 border border-red-400/20 rounded-lg p-2.5">
              {error}
            </p>
          )}

          {/* Success */}
          {saved && (
            <p className="text-sm text-teal-400 bg-teal-950 border border-teal-400/20 rounded-lg p-2.5">
              Settings saved.
            </p>
          )}

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="w-full bg-teal-400 text-slate-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-300 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      </div>

      <InstallMobileAppCard />
    </div>
  );
};
