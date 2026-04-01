import React, { useState } from 'react';
import { Copy, AlertTriangle, Info, ChevronDown, ChevronUp, Check, Flag } from 'lucide-react';
import { useCoderStore, BillingCode, CodeExtractionResult } from '../../stores/coderStore';

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9)
    return (
      <span className="text-xs bg-emerald-950 text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded-full">
        {Math.round(confidence * 100)}% High
      </span>
    );
  if (confidence >= 0.7)
    return (
      <span className="text-xs bg-amber-950 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded-full">
        {Math.round(confidence * 100)}%
      </span>
    );
  return (
    <span className="text-xs bg-red-950 text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-full">
      {Math.round(confidence * 100)}%
    </span>
  );
}

function CodeRow({ code }: { code: BillingCode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <code className="text-sm font-mono font-semibold text-teal-400">
            {code.code}
          </code>
          <span className="text-sm text-slate-300 truncate">
            {code.description}
          </span>
          {confidenceBadge(code.confidence)}
        </div>
        {(code.supporting_text || code.reasoning) && (
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
            <p className="text-xs text-slate-400 italic">
              &ldquo;{code.supporting_text}&rdquo;
            </p>
          )}
          {code.reasoning && (
            <p className="text-xs text-slate-500">{code.reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface CoderResultsPanelProps {
  patientFields?: {
    patientName: string;
    mrn: string;
    dateOfService: string;
    providerName: string;
    facility: string;
    noteType: string;
  };
  onSaved?: () => void;
}

export function CoderResultsPanel({ patientFields, onSaved }: CoderResultsPanelProps) {
  const { lastResult, extracting, extractError, clearResult } = useCoderStore();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (extracting) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center py-16 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-400">Analyzing note for billing codes...</p>
      </div>
    );
  }

  if (extractError) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-red-400">{extractError}</p>
        <button
          onClick={clearResult}
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!lastResult) return null;

  const handleCopyAll = () => {
    const lines: string[] = [];
    if (lastResult.icd10_codes.length > 0) {
      lines.push('ICD-10 Codes:');
      lastResult.icd10_codes.forEach((c) =>
        lines.push(`  ${c.code} - ${c.description}`),
      );
    }
    if (lastResult.cpt_codes.length > 0) {
      lines.push('');
      lines.push('CPT Codes:');
      lastResult.cpt_codes.forEach((c) =>
        lines.push(`  ${c.code} - ${c.description}`),
      );
    }
    if (lastResult.em_level) {
      lines.push('');
      lines.push(
        `E/M Level: ${lastResult.em_level.suggested} (${lastResult.em_level.mdm_complexity} complexity)`,
      );
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (status: 'reviewed' | 'coded' | 'flagged') => {
    if (!patientFields || saving) return;
    setSaving(true);
    setSaveMessage(null);
    const session = await useCoderStore.getState().saveSession({
      patientName: patientFields.patientName,
      mrn: patientFields.mrn || undefined,
      dateOfService: patientFields.dateOfService,
      providerName: patientFields.providerName,
      facility: patientFields.facility || undefined,
      noteType: patientFields.noteType,
      icd10Codes: lastResult.icd10_codes,
      cptCodes: lastResult.cpt_codes,
      emLevel: lastResult.em_level,
      missingDocumentation: lastResult.missing_documentation,
    });
    setSaving(false);
    if (session) {
      setSaveMessage(
        status === 'reviewed'
          ? 'Saved & marked reviewed'
          : status === 'flagged'
            ? 'Flagged for review'
            : 'Saved as coded',
      );
      if (status !== 'coded') {
        await useCoderStore.getState().updateSessionStatus(session.id, status);
      }
      setTimeout(() => {
        clearResult();
        setSaveMessage(null);
        onSaved?.();
      }, 1500);
    } else {
      setSaveMessage('Failed to save session');
    }
  };

  const totalCodes =
    lastResult.icd10_codes.length + lastResult.cpt_codes.length;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 flex flex-col gap-4">
      {/* Disclaimer */}
      {lastResult.disclaimer && (
        <div className="flex items-start gap-2 bg-amber-950/50 border border-amber-400/20 rounded-lg p-3">
          <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">{lastResult.disclaimer}</p>
        </div>
      )}

      {/* ICD-10 */}
      {lastResult.icd10_codes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            ICD-10 Diagnoses ({lastResult.icd10_codes.length})
          </h3>
          <div className="space-y-2">
            {lastResult.icd10_codes.map((code, i) => (
              <CodeRow key={`icd-${i}`} code={code} />
            ))}
          </div>
        </div>
      )}

      {/* CPT */}
      {lastResult.cpt_codes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            CPT / E&M Codes ({lastResult.cpt_codes.length})
          </h3>
          <div className="space-y-2">
            {lastResult.cpt_codes.map((code, i) => (
              <CodeRow key={`cpt-${i}`} code={code} />
            ))}
          </div>
        </div>
      )}

      {/* E/M Level */}
      {lastResult.em_level && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            E/M Level
          </h3>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono font-semibold text-teal-400">
                {lastResult.em_level.suggested}
              </code>
              <span className="text-xs bg-teal-950 text-teal-400 border border-teal-400/30 px-1.5 py-0.5 rounded-full">
                {lastResult.em_level.mdm_complexity} MDM
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {lastResult.em_level.reasoning}
            </p>
          </div>
        </div>
      )}

      {/* Missing Documentation */}
      {lastResult.missing_documentation.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <AlertTriangle
              size={12}
              className="inline mr-1 text-amber-400"
            />
            Missing Documentation
          </h3>
          <ul className="space-y-1">
            {lastResult.missing_documentation.map((item, i) => (
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

      {/* Action buttons */}
      {saveMessage && (
        <p className="text-sm text-teal-400 text-center">{saveMessage}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {totalCodes > 0 && (
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : `Copy All (${totalCodes})`}
          </button>
        )}

        {patientFields && (
          <>
            <button
              onClick={() => handleSave('reviewed')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              <Check size={14} />
              Save & Review
            </button>
            <button
              onClick={() => handleSave('coded')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => handleSave('flagged')}
              disabled={saving}
              className="flex items-center gap-1.5 bg-slate-800 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-amber-400 hover:bg-amber-950/40 disabled:text-slate-500 transition-colors"
            >
              <Flag size={14} />
              Flag
            </button>
          </>
        )}
      </div>
    </div>
  );
}
