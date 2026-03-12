import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

interface SegmentCTAProps {
  /** Headline text above the CTA. */
  headline?: string;
  /** Extra benefit bullets shown in the CTA card. */
  benefits?: string[];
}

const defaultBenefits = [
  'Full access to all features — record or paste chart data',
  'No credit card required to start',
  'HIPAA-compliant — all PHI de-identified before AI processing',
  'Built by clinicians, for clinicians — works on any device',
];

export default function SegmentCTA({
  headline = 'Ready to Reclaim Your Evenings?',
  benefits = defaultBenefits,
}: SegmentCTAProps) {
  return (
    <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-xl"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            {headline}
          </h2>

          <ul className="mt-8 space-y-3 text-left">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-slate-50">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-teal-400" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex justify-center">
            <Link
              to="/scribe/register"
              className="block w-full max-w-sm rounded-xl bg-teal-400 px-6 py-3.5 text-center text-lg font-semibold text-slate-900 shadow-lg shadow-teal-400/20 transition-colors hover:bg-teal-300"
            >
              Start Free Trial
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/scribe/login" className="text-teal-400 hover:text-teal-300">
              Sign in
            </Link>
          </p>
        </div>

        {/* Tagline */}
        <p className="mt-8 text-center text-sm text-slate-500 italic">
          Doc Assist AI &mdash; built by clinicians, for clinicians.
        </p>
      </motion.div>
    </section>
  );
}
