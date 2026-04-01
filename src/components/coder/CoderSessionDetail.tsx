import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';

interface BillingCode {
  code: string;
  description: string;
  confidence: number;
  supporting_text?: string;
  reasoning?: string;
}

interface EMLevel {
  suggested: string;
  mdm_complexity: string;
  reasoning: string;
}

interface SessionData {
  id: string;
  coder_user_id: string;
  team_id: string;
  patient_name: string;
  mrn: string | null;
  date_of_service: string;
  provider_name: string;
  facility: string | null;
  note_type: string;
  icd10_codes: BillingCode[];
  cpt_codes: BillingCode[];
  em_level: EMLevel | null;
  missing_documentation: string[];
  coder_status: 'coded' | 'reviewed' | 'flagged';
  batch_week: string;
  created_at: string;
}

type CoderStatus = 'coded' | 'reviewed' | 'flagged';

const STATUS_BADGE: Record<CoderStatus, { label: string; className: string }> = {
  reviewed: { label: 'Reviewed', className: 'bg-teal-900 text-teal-300' },
  coded: { label: 'Coded', className: 'bg-slate-800 text-slate-400' },
  flagged: { label: 'Flagged', className: 'bg-red-900 text-red-300' },
};

function confidenceBadge(confidence: number) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.9)
    return (
      <span className="text-xs bg-emerald-950 text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded-full">
        {pct}%
      </span>
    );
  if (confidence >= 0.7)
    return (
      <span className="text-xs bg-amber-950 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
        {pct}%
      </span>
    );
  return (
    <span className="text-xs bg-red-950 text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-full">
      {pct}%
    </span>
  );
}

function CodeCard({ code }: { code: BillingCode }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!(code.supporting_text || code.reasoning);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-sm font-mono font-semibold text-teal-400">{code.code}</code>
          <span className="text-sm text-slate-300 truncate">{code.description}</span>
          {confidenceBadge(code.confidence)}
        </div>
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-500 hover:text-slate-300 flex-shrink-0 p-1"
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 space-y-1">
          {code.supporting_text && (
            <p className="text-xs text-slate-400 italic">&ldquo;{code.supporting_text}&rdquo;</p>
          )}
          {code.reasoning && <p className="text-xs text-slate-500">{code.reasoning}</p>}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function CoderSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${getBackendUrl()}/api/scribe/coder/sessions/${id}`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load session (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleStatusChange = async (newStatus: CoderStatus) => {
    if (!id) return;
    setStatusDropdownOpen(false);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/sessions/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coder_status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setSession(updated);
    } catch {
      setError('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/coder/sessions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete session');
      navigate('/coder/dashboard');
    } catch {
      setError('Failed to delete session');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center" data-testid="loading">
        <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || 'Session not found'}</p>
        <Link to="/coder/dashboard" className="text-teal-400 hover:text-teal-300 text-sm">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[session.coder_status];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/coder/dashboard"
            className="flex items-center gap-1.5 text-sm text-teal-400 hover:text-teal-300 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>

          <div className="flex items-center gap-3">
            {/* Status dropdown */}
            <div className="relative">
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Change Status
                <ChevronDown size={14} />
              </button>
              {statusDropdownOpen && (
                <div className="absolute right-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10">
                  {(['coded', 'reviewed', 'flagged'] as CoderStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      {STATUS_BADGE[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete */}
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 bg-slate-800 border border-red-500/30 rounded-lg px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Patient header card */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-100">{session.patient_name}</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {session.mrn && <span>MRN: {session.mrn} &middot; </span>}
                DOS: {formatDate(session.date_of_service)}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.className}`} data-testid="status-badge">
              {badge.label}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Provider</span>
              <p className="text-slate-300 mt-0.5">{session.provider_name}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Facility</span>
              <p className="text-slate-300 mt-0.5">{session.facility || '\u2014'}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Note Type</span>
              <p className="text-slate-300 mt-0.5">{session.note_type}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wider">Batch Week</span>
              <p className="text-slate-300 mt-0.5">{session.batch_week}</p>
            </div>
          </div>
        </div>

        {/* ICD-10 Codes */}
        {session.icd10_codes.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              ICD-10 Diagnoses ({session.icd10_codes.length})
            </h2>
            <div className="space-y-2">
              {session.icd10_codes.map((code, i) => (
                <CodeCard key={`icd-${i}`} code={code} />
              ))}
            </div>
          </div>
        )}

        {/* CPT Codes */}
        {session.cpt_codes.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              CPT Codes ({session.cpt_codes.length})
            </h2>
            <div className="space-y-2">
              {session.cpt_codes.map((code, i) => (
                <CodeCard key={`cpt-${i}`} code={code} />
              ))}
            </div>
          </div>
        )}

        {/* E/M Level */}
        {session.em_level && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              E/M Level
            </h2>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <code className="text-sm font-mono font-semibold text-teal-400">
                  {session.em_level.suggested}
                </code>
                <span className="text-xs bg-teal-950 text-teal-400 border border-teal-400/30 px-1.5 py-0.5 rounded-full">
                  {session.em_level.mdm_complexity} MDM
                </span>
              </div>
              <p className="text-xs text-slate-400">{session.em_level.reasoning}</p>
            </div>
          </div>
        )}

        {/* Missing Documentation */}
        {session.missing_documentation.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
              Missing Documentation
            </h2>
            <ul className="space-y-1">
              {session.missing_documentation.map((item, i) => (
                <li
                  key={i}
                  className="text-xs text-amber-300 bg-amber-950/30 border border-amber-400/10 rounded-lg px-3 py-2"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
