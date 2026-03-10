import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

type CellValue = string | boolean | null;

interface ComparisonRow {
  feature: string;
  competitors: CellValue[];
  docassist: CellValue;
}

const competitorNames = [
  'Enterprise Scribe A',
  'Enterprise Scribe B',
  'Standalone Scribe C',
  'Standalone Scribe D',
];

const rows: ComparisonRow[] = [
  {
    feature: 'Monthly Cost',
    competitors: ['$600\u2013900/provider', '$225\u2013375/provider', '$99/provider', '$119/provider'],
    docassist: 'Free (beta)',
  },
  {
    feature: 'Free Tier',
    competitors: [false, false, '10-visit trial', '30 consults/mo'],
    docassist: 'Unlimited (beta)',
  },
  {
    feature: 'PII De-identification',
    competitors: [null, null, false, false],
    docassist: true,
  },
  {
    feature: 'PHI Reaches the AI',
    competitors: [true, true, true, true],
    docassist: false,
  },
  {
    feature: 'Fail-Closed if Service Down',
    competitors: [false, false, false, false],
    docassist: true,
  },
  {
    feature: 'Custom Note Templates',
    competitors: ['Limited', 'Specialty-specific', 'Learns your style', '55+ templates'],
    docassist: '72+ sections, 10 categories',
  },
  {
    feature: 'Self-Serve Signup',
    competitors: [false, false, true, true],
    docassist: true,
  },
  {
    feature: 'EHR Integration Required',
    competitors: ['Epic only', 'Epic/Cerner', false, false],
    docassist: false,
  },
  {
    feature: 'Built for PAs & NPs',
    competitors: [false, false, true, true],
    docassist: true,
  },
];

function CellContent({ value, invert }: { value: CellValue; invert?: boolean }) {
  if (value === true) {
    return invert ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-400/10">
        <X className="w-4 h-4 text-red-400" />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-400/10">
        <Check className="w-4 h-4 text-teal-400" />
      </span>
    );
  }
  if (value === false) {
    return invert ? (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-400/10">
        <Check className="w-4 h-4 text-teal-400" />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-400/10">
        <X className="w-4 h-4 text-red-400" />
      </span>
    );
  }
  if (value === null) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700/40">
        <Minus className="w-4 h-4 text-slate-500" />
      </span>
    );
  }
  return <span className="text-sm">{value}</span>;
}

export default function ComparisonTable() {
  return (
    <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
          How We Compare
        </h2>
        <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-12">
          See how DocAssistAI stacks up against other AI scribes on the market.
        </p>

        {/* ─── Desktop table (hidden on mobile) ─── */}
        <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="py-4 px-5 text-sm font-semibold text-slate-400 w-48">Feature</th>
                {competitorNames.map((name) => (
                  <th key={name} className="py-4 px-4 text-sm font-medium text-slate-500 text-center">
                    {name}
                  </th>
                ))}
                <th className="py-4 px-4 text-sm font-bold text-teal-400 text-center bg-teal-400/5">
                  DocAssistAI
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isPhiRow = row.feature === 'PHI Reaches the AI';
                const isEhrRow = row.feature === 'EHR Integration Required';
                const invertCompetitor = isPhiRow || isEhrRow;
                const invertDocassist = isPhiRow || isEhrRow;
                return (
                  <tr
                    key={row.feature}
                    className={`border-b border-slate-800/50 ${idx % 2 === 0 ? 'bg-slate-900/30' : ''}`}
                  >
                    <td className="py-3.5 px-5 text-sm font-medium text-slate-200">
                      {row.feature}
                    </td>
                    {row.competitors.map((val, i) => (
                      <td key={i} className="py-3.5 px-4 text-center text-slate-400">
                        <CellContent value={val} invert={invertCompetitor} />
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-center font-semibold text-teal-300 bg-teal-400/5">
                      <CellContent value={row.docassist} invert={invertDocassist} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Mobile cards (shown on mobile & tablet) ─── */}
        <div className="lg:hidden space-y-4">
          {rows.map((row) => {
            const isPhiRow = row.feature === 'PHI Reaches the AI';
            const isEhrRow = row.feature === 'EHR Integration Required';
            const invertDocassist = isPhiRow || isEhrRow;
            return (
              <div
                key={row.feature}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
              >
                <h3 className="text-sm font-semibold text-slate-200 mb-3">{row.feature}</h3>
                <div className="flex items-center justify-between rounded-lg bg-teal-400/5 border border-teal-400/20 px-3 py-2 mb-2">
                  <span className="text-sm font-semibold text-teal-400">DocAssistAI</span>
                  <span className="text-sm font-semibold text-teal-300">
                    <CellContent value={row.docassist} invert={invertDocassist} />
                  </span>
                </div>
                <div className="space-y-1.5">
                  {row.competitors.map((val, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-slate-400">
                      <span className="text-xs">{competitorNames[i]}</span>
                      <span className="text-xs">
                        <CellContent value={val} invert={isPhiRow || isEhrRow} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
