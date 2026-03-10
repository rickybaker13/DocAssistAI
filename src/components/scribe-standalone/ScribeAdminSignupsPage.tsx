import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Download, Search, Users, TrendingUp, Clock, XCircle } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { Navigate } from 'react-router-dom';

interface SignupRecord {
  id: string;
  email: string;
  name: string | null;
  specialty: string | null;
  signup_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_code: string | null;
  device_type: string | null;
  ip_country: string | null;
  ip_region: string | null;
  subscription_status: string;
  billing_cycle: string | null;
  payment_method: string | null;
  trial_ends_at: string | null;
  converted_at: string | null;
  cancelled_at: string | null;
  non_conversion_reason: string | null;
  non_conversion_detail: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  trialing: number;
  active: number;
  cancelled: number;
  expired: number;
  conversionRate: number;
}

const STATUS_COLORS: Record<string, string> = {
  trialing: 'text-blue-400 bg-blue-950 border-blue-400/30',
  active: 'text-emerald-400 bg-emerald-950 border-emerald-400/30',
  cancelled: 'text-amber-400 bg-amber-950 border-amber-400/30',
  expired: 'text-red-400 bg-red-950 border-red-400/30',
};

const NON_CONVERSION_LABELS: Record<string, string> = {
  too_expensive: 'Too expensive',
  did_not_work_well: 'Didn\'t work well',
  did_not_use_it: 'Didn\'t use it',
  switched_to_another_product: 'Switched products',
  other: 'Other',
};

const formatDate = (val: string | null | undefined): string => {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (val: string | null | undefined): string => {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export const ScribeAdminSignupsPage: React.FC = () => {
  const user = useScribeAuthStore(s => s.user);
  const [records, setRecords] = useState<SignupRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (user && !user.is_admin) return <Navigate to="/scribe/dashboard" replace />;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    try {
      const [recordsRes, statsRes] = await Promise.all([
        fetch(`${getBackendUrl()}/api/scribe/admin/signups?${params}`, { credentials: 'include' }),
        fetch(`${getBackendUrl()}/api/scribe/admin/signups/stats`, { credentials: 'include' }),
      ]);
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterStatus, search, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    window.open(`${getBackendUrl()}/api/scribe/admin/signups/export?${params}`, '_blank');
  };

  const selectClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-400';
  const inputClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-50 flex items-center gap-2">
            <Shield size={22} className="text-teal-400" />
            Admin — User Signups
          </h1>
          <p className="text-sm text-slate-400 mt-1">{records.length} signups tracked</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-300 transition-colors text-sm"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total Signups" value={stats.total} color="text-slate-300" />
          <StatCard icon={Clock} label="Trialing" value={stats.trialing} color="text-blue-400" />
          <StatCard icon={TrendingUp} label="Active" value={stats.active} color="text-emerald-400" />
          <StatCard icon={XCircle} label="Cancelled" value={stats.cancelled} color="text-amber-400" />
          <StatCard
            icon={TrendingUp}
            label="Conversion Rate"
            value={`${stats.conversionRate}%`}
            color="text-teal-400"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          <option value="trialing">Trialing</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass} />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Signed Up</th>
              <th className="text-left px-4 py-3">Source</th>
              <th className="text-left px-4 py-3">Device</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Non-Conversion</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-500">Loading...</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-500">No signups found.</td></tr>
            )}
            {!loading && records.map(r => (
              <React.Fragment key={r.id}>
                <tr
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-slate-200 font-medium">{r.email}</div>
                    <div className="text-xs text-slate-500">{r.name ?? '—'} {r.specialty ? `· ${r.specialty}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-slate-400">{r.signup_source || r.utm_source || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{r.device_type || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[r.subscription_status] ?? STATUS_COLORS.expired}`}>
                      {r.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 capitalize">
                    {r.billing_cycle || '—'}
                    {r.payment_method ? ` · ${r.payment_method.replace('square_', '')}` : ''}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.non_conversion_reason
                      ? NON_CONVERSION_LABELS[r.non_conversion_reason] ?? r.non_conversion_reason
                      : '—'}
                  </td>
                </tr>
                {expandedId === r.id && (
                  <tr className="border-t border-slate-800/50">
                    <td colSpan={7} className="bg-slate-950/50 px-6 py-4">
                      <ExpandedDetails record={r} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon: Icon, label, value, color }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-1">
      <Icon size={16} className={color} />
      <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
  </div>
);

const ExpandedDetails: React.FC<{ record: SignupRecord }> = ({ record: r }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
    <DetailItem label="Email" value={r.email} />
    <DetailItem label="Name" value={r.name} />
    <DetailItem label="Specialty" value={r.specialty} />
    <DetailItem label="Signup Date" value={formatDateTime(r.created_at)} />
    <DetailItem label="Signup Source" value={r.signup_source} />
    <DetailItem label="UTM Source" value={r.utm_source} />
    <DetailItem label="UTM Medium" value={r.utm_medium} />
    <DetailItem label="UTM Campaign" value={r.utm_campaign} />
    <DetailItem label="Referral Code" value={r.referral_code} />
    <DetailItem label="Device" value={r.device_type} />
    <DetailItem label="Country" value={r.ip_country} />
    <DetailItem label="Region" value={r.ip_region} />
    <DetailItem label="Trial Ends" value={formatDate(r.trial_ends_at)} />
    <DetailItem label="Converted At" value={formatDateTime(r.converted_at)} />
    <DetailItem label="Cancelled At" value={formatDateTime(r.cancelled_at)} />
    <DetailItem label="Billing Cycle" value={r.billing_cycle} />
    <DetailItem label="Payment Method" value={r.payment_method?.replace('square_', '')} />
    <DetailItem label="Non-Conversion Reason" value={
      r.non_conversion_reason
        ? NON_CONVERSION_LABELS[r.non_conversion_reason] ?? r.non_conversion_reason
        : null
    } />
    {r.non_conversion_detail && (
      <div className="sm:col-span-2 lg:col-span-3">
        <DetailItem label="Non-Conversion Detail" value={r.non_conversion_detail} />
      </div>
    )}
  </div>
);

const DetailItem: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div>
    <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
    <p className="text-slate-300 mt-0.5">{value || '—'}</p>
  </div>
);
