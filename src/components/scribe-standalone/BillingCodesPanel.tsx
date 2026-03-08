import React from 'react';
import { Copy, AlertTriangle, Info } from 'lucide-react';
import { BillingCodesResult, BillingCode } from '../../stores/scribeNoteStore';

interface Props {
  result: BillingCodesResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function confidenceBadge(confidence: number) {
  if (confidence >= 0.9)
    return (
      <span className="text-xs bg-emerald-950 text-emerald-400 border border-emerald-400/30 px-1.5 py-0.5 rounded-full">
        {Math.round(confidence * 100)}%
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

function CodeCard({ code, onCopy }: { code: BillingCode; onCopy: (text: string) => void }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-sm font-mono font-semibold text-teal-400">{code.code}</code>
          {confidenceBadge(code.confidence)}
        </div>
        <p className="text-sm text-slate-300">{code.description}</p>
        {code.supporting_text && (
          <p className="text-xs text-slate-500 mt-1 italic">&ldquo;{code.supporting_text}&rdquo;</p>
        )}
        {code.reasoning && (
          <p className="text-xs text-slate-500 mt-1">{code.reasoning}</p>
        )}
      </div>
      <button
        onClick={() => onCopy(code.code)}
        aria-label={`Copy code ${code.code}`}
        className="text-slate-500 hover:text-teal-400 transition-colors flex-shrink-0 p-1"
      >
        <Copy size={14} />
      </button>
    </div>
  );
}

export const BillingCodesPanel: React.FC<Props> = ({ result, loading, error, onRetry }) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCopyAll = () => {
    if (!result) return;
    const lines: string[] = [];
    if (result.icd10_codes.length > 0) {
      lines.push('ICD-10 Codes:');
      result.icd10_codes.forEach(c => lines.push(`  ${c.code} — ${c.description}`));
    }
    if (result.cpt_codes.length > 0) {
      lines.push('');
      lines.push('CPT Codes:');
      result.cpt_codes.forEach(c => lines.push(`  ${c.code} — ${c.description}`));
    }
    if (result.em_level) {
      lines.push('');
      lines.push(`E/M Level: ${result.em_level.suggested} (${result.em_level.mdm_complexity} complexity)`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="animate-spin h-8 w-8 border-4 border-teal-400 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-400">Analyzing note for billing codes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={onRetry}
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!result) return null;

  const totalCodes = result.icd10_codes.length + result.cpt_codes.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-amber-950/50 border border-amber-400/20 rounded-xl p-3">
        <Info size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">{result.disclaimer}</p>
      </div>

      {/* ICD-10 Diagnosis Codes */}
      {result.icd10_codes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            ICD-10 Diagnosis Codes ({result.icd10_codes.length})
          </h3>
          <div className="space-y-2">
            {result.icd10_codes.map((code, i) => (
              <CodeCard key={`icd-${i}`} code={code} onCopy={handleCopy} />
            ))}
          </div>
        </div>
      )}

      {/* CPT Procedure Codes */}
      {result.cpt_codes.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            CPT Codes ({result.cpt_codes.length})
          </h3>
          <div className="space-y-2">
            {result.cpt_codes.map((code, i) => (
              <CodeCard key={`cpt-${i}`} code={code} onCopy={handleCopy} />
            ))}
          </div>
        </div>
      )}

      {/* E/M Level */}
      {result.em_level && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            E/M Level
          </h3>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-sm font-mono font-semibold text-teal-400">{result.em_level.suggested}</code>
              <span className="text-xs bg-teal-950 text-teal-400 border border-teal-400/30 px-1.5 py-0.5 rounded-full">
                {result.em_level.mdm_complexity} MDM
              </span>
            </div>
            <p className="text-xs text-slate-400">{result.em_level.reasoning}</p>
          </div>
        </div>
      )}

      {/* Missing Documentation */}
      {result.missing_documentation.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
            Missing Documentation
          </h3>
          <ul className="space-y-1">
            {result.missing_documentation.map((item, i) => (
              <li key={i} className="text-xs text-amber-300 bg-amber-950/30 border border-amber-400/10 rounded-lg px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Copy All */}
      {totalCodes > 0 && (
        <button
          onClick={handleCopyAll}
          className="flex items-center justify-center gap-2 w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
        >
          <Copy size={14} />
          Copy all codes ({totalCodes})
        </button>
      )}
    </div>
  );
};

export default BillingCodesPanel;
