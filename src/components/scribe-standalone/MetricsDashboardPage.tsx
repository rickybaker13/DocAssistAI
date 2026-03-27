import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Loader2, Calendar, TrendingUp, Users, Activity, Download, Plus, Printer, X, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useMetrics } from '../../hooks/useTeamMetrics';
import { getBackendUrl } from '../../config/appConfig';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EVENT_LABELS: Record<string, string> = {
  patient_encounter: 'Patient Encounters',
  admission: 'Admissions',
  discharge: 'Discharges',
  transfer: 'Transfers',
  procedure: 'Procedures',
  consult: 'Consults',
  code_response: 'Code Responses',
  family_meeting: 'Family Meetings',
  note_completed: 'Notes Completed',
  custom: 'Custom',
};

const QUICK_LOG_EVENTS = [
  { value: 'patient_encounter', label: 'Patient Encounter' },
  { value: 'admission', label: 'Admission' },
  { value: 'discharge', label: 'Discharge' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'consult', label: 'Consult' },
  { value: 'code_response', label: 'Code Response' },
  { value: 'family_meeting', label: 'Family Meeting' },
  { value: 'transfer', label: 'Transfer' },
];

const CHART_COLORS = ['#2dd4bf', '#38bdf8', '#a78bfa', '#fb923c', '#f472b6', '#facc15', '#34d399', '#f87171'];

function eventLabel(type: string): string {
  return EVENT_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from: Date;

  switch (preset) {
    case '7d':
      from = new Date(now); from.setDate(from.getDate() - 7); break;
    case '30d':
      from = new Date(now); from.setDate(from.getDate() - 30); break;
    case '90d':
      from = new Date(now); from.setDate(from.getDate() - 90); break;
    default:
      from = new Date(now); from.setDate(from.getDate() - 30); break;
  }

  return { from: from.toISOString().slice(0, 10), to };
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
    <div className="flex items-center gap-2 mb-1 text-slate-400">
      {icon}
      <span className="text-xs uppercase tracking-wider">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
  </div>
);

// ---------------------------------------------------------------------------
// Quick Log Modal
// ---------------------------------------------------------------------------

const QuickLogModal: React.FC<{
  teamId: string;
  onClose: () => void;
  onLogged: () => void;
}> = ({ teamId, onClose, onLogged }) => {
  const [eventType, setEventType] = useState('patient_encounter');
  const [customLabel, setCustomLabel] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const events = Array.from({ length: count }, () => ({
        eventType,
        eventDate,
        metadata: customLabel ? { label: customLabel } : undefined,
      }));

      if (events.length === 1) {
        await fetch(`${getBackendUrl()}/api/metrics/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ teamId, eventType, eventDate, metadata: customLabel ? { label: customLabel } : {} }),
        });
      } else {
        await fetch(`${getBackendUrl()}/api/metrics/log/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ teamId, events }),
        });
      }

      setSuccess(true);
      setTimeout(() => { onLogged(); onClose(); }, 600);
    } catch { /* best-effort */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Quick Log Event</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {QUICK_LOG_EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Label (optional)</label>
            <input
              type="text"
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value)}
              placeholder="e.g., Central line, Family Mtg Room 4"
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Count</label>
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || success}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {success ? <><Check className="w-4 h-4" /> Logged!</> : submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Log ${count > 1 ? `${count} Events` : 'Event'}`}
          </button>
        </form>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export const MetricsDashboardPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [preset, setPreset] = useState('30d');
  const dateRange = useMemo(() => getPresetDates(preset), [preset]);
  const { summary, daily, providers, loading, fetchAll } = useMetrics(teamId ?? null, dateRange);
  const [showQuickLog, setShowQuickLog] = useState(false);

  const totalEvents = summary.reduce((sum, s) => sum + s.count, 0);
  const totalEncounters = summary.find(s => s.event_type === 'patient_encounter')?.count ?? 0;
  const totalProcedures = summary.find(s => s.event_type === 'procedure')?.count ?? 0;
  const uniqueDays = useMemo(() => new Set(daily.map(d => d.event_date)).size, [daily]);
  const avgPerDay = uniqueDays > 0 ? (totalEvents / uniqueDays).toFixed(1) : '0';

  // Aggregate daily data for the bar chart
  const dailyChartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const d of daily) {
      if (!byDate[d.event_date]) byDate[d.event_date] = {};
      byDate[d.event_date][d.event_type] = (byDate[d.event_date][d.event_type] || 0) + d.count;
    }
    return Object.entries(byDate)
      .map(([date, types]) => ({ date: date.slice(5), ...types }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [daily]);

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    daily.forEach(d => types.add(d.event_type));
    return Array.from(types);
  }, [daily]);

  const providerTable = useMemo(() => {
    const byProvider: Record<string, { name: string; email: string; total: number; breakdown: Record<string, number> }> = {};
    for (const p of providers) {
      if (!byProvider[p.user_id]) {
        byProvider[p.user_id] = { name: p.name || p.email, email: p.email, total: 0, breakdown: {} };
      }
      byProvider[p.user_id].total += p.count;
      byProvider[p.user_id].breakdown[p.event_type] = p.count;
    }
    return Object.values(byProvider).sort((a, b) => b.total - a.total);
  }, [providers]);

  const pieData = summary.map(s => ({ name: eventLabel(s.event_type), value: s.count }));

  const handleExportCSV = () => {
    const url = `${getBackendUrl()}/api/metrics/${teamId}/export?from=${dateRange.from}&to=${dateRange.to}`;
    // Use a hidden form to POST with credentials (cookie-based auth)
    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    // For cookie-based auth, open in same origin via fetch
    fetch(url, { credentials: 'include' })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = `metrics_${dateRange.from}_to_${dateRange.to}.csv`;
        link.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => { /* best-effort */ });
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/scribe/teams" className="p-2 rounded-lg hover:bg-slate-800 transition-colors print:hidden">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <BarChart3 className="w-6 h-6 text-teal-400" />
          <h1 className="text-xl font-semibold text-white">Metrics Dashboard</h1>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {/* Quick Log */}
          <button
            onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition-colors"
            title="Quick log an event"
          >
            <Plus className="w-3.5 h-3.5" /> Log
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
            title="Export as CSV"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>

          {/* Print Report */}
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
            title="Print report"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>

          {/* Date range selector */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {[
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: '90d', label: '90D' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === key ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block mb-4">
        <p className="text-sm text-slate-400">{dateRange.from} to {dateRange.to}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <StatCard label="Total Events" value={totalEvents} icon={<Activity className="w-4 h-4" />} />
            <StatCard label="Encounters" value={totalEncounters} icon={<Users className="w-4 h-4" />} />
            <StatCard label="Procedures" value={totalProcedures} icon={<TrendingUp className="w-4 h-4" />} />
            <StatCard label="Days Active" value={uniqueDays} icon={<Calendar className="w-4 h-4" />} />
            <StatCard label="Avg / Day" value={avgPerDay} icon={<BarChart3 className="w-4 h-4" />} />
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-3 gap-4 mb-6 print:break-inside-avoid">
            {/* Daily Trend — Bar Chart */}
            <div className="md:col-span-2 p-4 bg-slate-800 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Daily Activity</h3>
              {dailyChartData.length === 0 ? (
                <p className="text-slate-500 text-sm py-12 text-center">No data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                      itemStyle={{ color: '#94a3b8' }}
                    />
                    {eventTypes.map((type, i) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        name={eventLabel(type)}
                        stackId="a"
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={i === eventTypes.length - 1 ? [2, 2, 0, 0] : undefined}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Pie Chart — Event Type Breakdown */}
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">By Type</h3>
              {pieData.length === 0 ? (
                <p className="text-slate-500 text-sm py-12 text-center">No data</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Summary Table */}
          {summary.length > 0 && (
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6 print:break-inside-avoid">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Event Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {summary.map(s => (
                  <div key={s.event_type} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                    <span className="text-sm text-slate-300">{eventLabel(s.event_type)}</span>
                    <span className="text-sm font-medium text-teal-400">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider Breakdown Table */}
          {providerTable.length > 0 && (
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 print:break-inside-avoid">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Provider Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Provider</th>
                      <th className="text-right py-2 px-3 text-slate-400 font-medium">Total</th>
                      {eventTypes.slice(0, 5).map(type => (
                        <th key={type} className="text-right py-2 px-3 text-slate-400 font-medium hidden md:table-cell">
                          {eventLabel(type)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {providerTable.map(p => (
                      <tr key={p.email} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-3 text-white">{p.name}</td>
                        <td className="py-2 px-3 text-right text-teal-400 font-medium">{p.total}</td>
                        {eventTypes.slice(0, 5).map(type => (
                          <td key={type} className="py-2 px-3 text-right text-slate-300 hidden md:table-cell">
                            {p.breakdown[type] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {totalEvents === 0 && (
            <div className="text-center py-16 text-slate-500">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-slate-400 mb-2">No metrics logged yet</p>
              <p className="text-sm mb-4">Metrics will appear here as your team logs patient encounters, procedures, and other clinical activity.</p>
              <button
                onClick={() => setShowQuickLog(true)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Log Your First Event
              </button>
            </div>
          )}
        </>
      )}

      {/* Quick Log Modal */}
      {showQuickLog && teamId && (
        <QuickLogModal
          teamId={teamId}
          onClose={() => setShowQuickLog(false)}
          onLogged={fetchAll}
        />
      )}
    </div>
  );
};
