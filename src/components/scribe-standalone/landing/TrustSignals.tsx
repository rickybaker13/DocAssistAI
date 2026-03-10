import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, ShieldOff, Database, Radio, UserCheck } from 'lucide-react';

const signals = [
  {
    icon: Shield,
    title: 'HIPAA Compliant',
    description: 'Built to meet HIPAA security and privacy requirements from the ground up.',
  },
  {
    icon: Lock,
    title: 'PII De-identified Before AI',
    description: 'Patient data is scrubbed by Microsoft Presidio before anything reaches the AI model.',
  },
  {
    icon: ShieldOff,
    title: 'Fail-Closed Architecture',
    description: 'If de-identification is unavailable, the system stops. It never proceeds unprotected.',
  },
  {
    icon: Database,
    title: 'No PHI Stored or Logged',
    description: 'Substitution maps are request-scoped. Patient data is never persisted or logged.',
  },
  {
    icon: Radio,
    title: 'Encrypted in Transit',
    description: 'All data is encrypted via TLS. Audio, transcripts, and notes are protected end to end.',
  },
  {
    icon: UserCheck,
    title: 'Clinician Reviews Every Note',
    description: 'AI generates a draft. You review, edit, and finalize before any note leaves the app.',
  },
];

export default function TrustSignals() {
  return (
    <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <motion.div
        className="max-w-5xl mx-auto"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
          Security You Can Trust
        </h2>
        <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-12">
          Your patients' data deserves the highest standard of protection.
          DocAssistAI was engineered with privacy at its core.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {signals.map((signal, index) => {
            const Icon = signal.icon;
            return (
              <motion.div
                key={signal.title}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-colors"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-teal-400/10">
                  <Icon className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="text-slate-50 font-semibold text-lg mb-2">
                  {signal.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {signal.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/security"
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Read our full security architecture
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
