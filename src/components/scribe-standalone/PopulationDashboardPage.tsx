import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Database, Loader2, Search, Activity, AlertTriangle, Stethoscope, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { usePopulationStats, usePopulationQuery } from '../../hooks/useEncounterData';

const CHART_COLORS = ['#2dd4bf', '#38bdf8', '#a78bfa', '#fb923c', '#f472b6', '#facc15', '#34d399', '#f87171', '#818cf8', '#fb7185'];

function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  let from: Date;
  switch (preset) {
    case '30d': from = new Date(now); from.setDate(from.getDate() - 30); break;
    case '90d': from = new Date(now); from.setDate(from.getDate() - 90); break;
    case '1y': from = new Date(now); from.setFullYear(from.getFullYear() - 1); break;
    default: from = new Date(now); from.setDate(from.getDate() - 90); break;
  }
  return { from: from.toISOString().slice(0, 10), to };
}

export const PopulationDashboardPage: React.FC = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const [preset, setPreset] = useState('90d');
  const dateRange = useMemo(() => getPresetDates(preset), [preset]);
  const { stats, loading: statsLoading, fetchStats } = usePopulationStats(teamId ?? null, dateRange);
  const { encounters, total, loading: queryLoading, search } = usePopulationQuery(teamId ?? null);

  // Search filters
  const [diagnosisFilter, setDiagnosisFilter] = useState('');
  const [complicationFilter, setComplicationFilter] = useState('');

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSearch = () => {
    search({
      ...dateRange,
      diagnosis: diagnosisFilter || undefined,
      complication: complicationFilter || undefined,
      limit: 50,
    });
  };

  // Run initial search on mount
  useEffect(() => {
    if (teamId) search({ ...dateRange, limit: 50 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, dateRange.from, dateRange.to]);

  const diagnosisData = (stats?.diagnoses || []).slice(0, 10).map(d => ({
    name: d.primary_diagnosis, value: d.count,
  }));

  const complicationData = (stats?.complications || []).slice(0, 10);
  const dispositionData = (stats?.dispositions || []).map(d => ({
    name: d.disposition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    value: d.count,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/scribe/teams" className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </Link>
          <Database className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl font-semibold text-white">Clinical Registry</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/scribe/teams/${teamId}/metrics`}
            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Workload
          </Link>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
            {[
              { key: '30d', label: '30D' },
              { key: '90d', label: '90D' },
              { key: '1y', label: '1Y' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  preset === key ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-400 animate-spin" /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-1 text-slate-400">
                <Activity className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Total Encounters</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-1 text-slate-400">
                <Stethoscope className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Unique Diagnoses</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.diagnoses.length ?? 0}</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-1 text-slate-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Complications</span>
              </div>
              <p className="text-2xl font-bold text-white">{stats?.complications.reduce((s, c) => s + c.count, 0) ?? 0}</p>
            </div>
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-1 text-slate-400">
                <Database className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Acuity Scores</span>
              </div>
              <div className="text-sm text-white">
                {Object.entries(stats?.acuityAverages || {}).slice(0, 2).map(([k, v]) => (
                  <span key={k} className="mr-2">{k}: <span className="text-amber-400">{v}</span></span>
                ))}
                {Object.keys(stats?.acuityAverages || {}).length === 0 && <span className="text-slate-500">—</span>}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Top Diagnoses */}
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Top Diagnoses</h3>
              {diagnosisData.length === 0 ? (
                <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={diagnosisData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={150} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                    <Bar dataKey="value" fill="#2dd4bf" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Disposition Breakdown */}
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Dispositions</h3>
              {dispositionData.length === 0 ? (
                <p className="text-slate-500 text-sm py-8 text-center">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={dispositionData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                      {dispositionData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Complications Table */}
          {complicationData.length > 0 && (
            <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3">Complications</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {complicationData.map(c => (
                  <div key={c.complication} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg">
                    <span className="text-sm text-slate-300">{c.complication}</span>
                    <span className="text-sm font-medium text-red-400">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search / Query */}
          <div className="p-4 bg-slate-800 rounded-xl border border-slate-700 mb-6">
            <h3 className="text-sm font-medium text-slate-400 mb-3">Search Encounters</h3>
            <div className="flex gap-2 mb-3 flex-wrap">
              <input
                value={diagnosisFilter}
                onChange={e => setDiagnosisFilter(e.target.value)}
                placeholder="Search by diagnosis..."
                className="flex-1 min-w-[200px] bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <input
                value={complicationFilter}
                onChange={e => setComplicationFilter(e.target.value)}
                placeholder="Filter by complication..."
                className="flex-1 min-w-[200px] bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                onClick={handleSearch}
                disabled={queryLoading}
                className="flex items-center gap-1 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {queryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
            </div>

            {/* Results */}
            <p className="text-xs text-slate-500 mb-2">{total} encounters found</p>
            {encounters.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Primary Diagnosis</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium hidden md:table-cell">Complications</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium hidden md:table-cell">Acuity</th>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium">Disposition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {encounters.map(enc => (
                      <tr key={enc.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                        <td className="py-2 px-3 text-slate-300 text-xs">{new Date(enc.created_at).toLocaleDateString()}</td>
                        <td className="py-2 px-3 text-white">{enc.primary_diagnosis || '—'}</td>
                        <td className="py-2 px-3 text-red-400 text-xs hidden md:table-cell">
                          {(enc.complications || []).join(', ') || '—'}
                        </td>
                        <td className="py-2 px-3 text-amber-400 text-xs hidden md:table-cell">
                          {Object.entries(enc.acuity_scores || {}).map(([k, v]) => `${k}:${v}`).join(', ') || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-xs">
                          {enc.disposition?.replace(/_/g, ' ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Empty State */}
          {(stats?.total ?? 0) === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Database className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium text-slate-400 mb-2">No clinical data captured yet</p>
              <p className="text-sm">Clinical data will appear here as notes are finalized and AI extracts diagnoses, complications, and acuity scores.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
