import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { useCoderStore, CoderSession } from '../../stores/coderStore';
import { getBackendUrl } from '../../config/appConfig';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  reviewed: { label: 'Reviewed', class: 'text-teal-400' },
  coded: { label: 'Coded', class: 'text-slate-400' },
  flagged: { label: 'Flagged', class: 'text-amber-400' },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function WeeklyBatchTable() {
  const navigate = useNavigate();
  const { sessions, sessionsLoading, sessionsError, fetchSessions } =
    useCoderStore();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSessions({ limit: 50 });
  }, [fetchSessions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sessions.map((s) => s.id)));
    }
  };

  const handleExport = (range: 'week' | 'all') => {
    const params = new URLSearchParams();
    if (range === 'week') {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      params.set('from', weekAgo.toISOString().slice(0, 10));
      params.set('to', now.toISOString().slice(0, 10));
    }
    const url = `${getBackendUrl()}/api/scribe/coder/export?${params}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coder-export.csv';
    a.click();
  };

  const statusBadge = (status: string) => {
    const info = STATUS_LABELS[status] || {
      label: status,
      class: 'text-slate-400',
    };
    return <span className={`text-xs font-medium ${info.class}`}>{info.label}</span>;
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Recent Sessions
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('week')}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Download size={12} />
            Export This Week
          </button>
          <button
            onClick={() => handleExport('all')}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Download size={12} />
            Export All
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {sessionsLoading && (
        <p className="text-sm text-slate-500 py-8 text-center">
          Loading sessions...
        </p>
      )}
      {sessionsError && (
        <p className="text-sm text-red-400 py-8 text-center">
          {sessionsError}
        </p>
      )}

      {/* Table */}
      {!sessionsLoading && !sessionsError && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-700 text-xs text-slate-500 uppercase">
                  <th className="py-2 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        sessions.length > 0 &&
                        selectedIds.size === sessions.length
                      }
                      onChange={toggleAll}
                      className="rounded border-slate-600"
                    />
                  </th>
                  <th className="py-2 px-2">Patient</th>
                  <th className="py-2 px-2">DOS</th>
                  <th className="py-2 px-2">Provider</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2 text-center">Dx</th>
                  <th className="py-2 px-2 text-center">CPT</th>
                  <th className="py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/coder/session/${s.id}`)}
                    className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td
                      className="py-2.5 pr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="rounded border-slate-600"
                      />
                    </td>
                    <td className="py-2.5 px-2 text-slate-200 font-medium">
                      {s.patient_name}
                    </td>
                    <td className="py-2.5 px-2 text-slate-400">
                      {formatDate(s.date_of_service)}
                    </td>
                    <td className="py-2.5 px-2 text-slate-400">
                      {s.provider_name}
                    </td>
                    <td className="py-2.5 px-2 text-slate-400">
                      {s.note_type}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {s.icd10_codes?.length ?? 0}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {s.cpt_codes?.length ?? 0}
                    </td>
                    <td className="py-2.5 px-2">
                      {statusBadge(s.coder_status)}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-slate-500 text-sm"
                    >
                      No sessions yet. Generate codes above to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {sessions.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">
              {sessions.length} encounter{sessions.length !== 1 ? 's' : ''}{' '}
              loaded
            </p>
          )}
        </>
      )}
    </div>
  );
}
