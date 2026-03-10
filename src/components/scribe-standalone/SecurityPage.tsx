import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Shield,
  Lock,
  ShieldOff,
  Database,
  Radio,
  UserCheck,
  Mic,
  FileText,
  Sparkles,
  ArrowDown,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentFooter from './landing/SegmentFooter';

/* ─── Animation helpers ─── */
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

/* ─── Flow steps for the PII diagram ─── */
const flowSteps = [
  {
    icon: Mic,
    label: 'Audio Recording',
    detail: 'Clinician records the patient encounter on their device.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
  {
    icon: Radio,
    label: 'Encrypted Transit (TLS)',
    detail: 'Audio is encrypted end-to-end via TLS through Caddy reverse proxy.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: FileText,
    label: 'Transcription',
    detail: 'Audio is transcribed to text on our secure server. Audio is not persisted.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
  {
    icon: Shield,
    label: 'Presidio De-identification',
    detail:
      'Microsoft Presidio identifies and replaces all PII/PHI with typed tokens: [PERSON_0], [DATE_0], [MEDICAL_RECORD_NUMBER_0], etc.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    highlight: true,
  },
  {
    icon: Sparkles,
    label: 'AI Note Generation',
    detail:
      'Only de-identified text reaches the AI model. The AI generates a structured clinical note using tokens — it never sees real patient data.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
  },
  {
    icon: Shield,
    label: 'Presidio Re-injection',
    detail:
      'Presidio replaces tokens with original PHI values using a request-scoped substitution map. The map is never persisted or logged.',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    highlight: true,
  },
  {
    icon: Radio,
    label: 'Encrypted Response (TLS)',
    detail: 'The complete note with restored PHI is encrypted and sent back to the clinician.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  {
    icon: UserCheck,
    label: 'Clinician Review',
    detail:
      'The clinician reviews, edits, and finalizes the note before it is used for any clinical purpose.',
    color: 'text-slate-400',
    bg: 'bg-slate-800',
  },
];

/* ─── Security commitments ─── */
const commitments = [
  {
    icon: Shield,
    title: 'Patient data is de-identified before it ever reaches the AI',
    detail:
      'Microsoft Presidio analyzes every text field for 20+ entity types: names, dates, MRNs, phone numbers, addresses, and more. Each detected entity is replaced with a typed placeholder token before the text is sent to the AI model.',
  },
  {
    icon: ShieldOff,
    title: 'If de-identification is unavailable, the system stops',
    detail:
      'DocAssistAI operates on a fail-closed principle. If the Presidio service is unreachable or returns an error, the system returns a 503 error to the client. The AI is never called without de-identification.',
  },
  {
    icon: Database,
    title: 'Substitution maps are request-scoped, never persisted, never logged',
    detail:
      'The mapping between tokens ([PERSON_0]) and real values exists only in server memory for the duration of a single request. It is garbage-collected immediately after the response is sent. No log file, database, or cache ever contains this mapping.',
  },
  {
    icon: Radio,
    title: 'All traffic encrypted via TLS',
    detail:
      'Caddy reverse proxy handles TLS termination with automatic certificate management. Audio uploads, API requests, and responses are encrypted in transit. Internal service communication runs over Docker\u2019s isolated network.',
  },
  {
    icon: Lock,
    title: 'HIPAA-compliant architecture',
    detail:
      'DocAssistAI is designed to meet the HIPAA Security Rule requirements for access controls, audit controls, transmission security, and integrity controls. Business Associate Agreements (BAAs) are available.',
  },
  {
    icon: UserCheck,
    title: 'Clinician reviews every note before it is finalized',
    detail:
      'AI output is always a draft. The clinician must review, edit if needed, and approve the note before it can be used. DocAssistAI is a clinical support tool, not an autonomous documentation system.',
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/security" />

      <main>
        {/* ─── Hero ─── */}
        <section className="relative overflow-hidden bg-slate-950 px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06)_0%,transparent_70%)]" />
          <motion.div
            className="relative z-10 mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.12 } } }}
          >
            <motion.div variants={fadeIn}>
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-300 mb-6">
                <Shield className="w-3.5 h-3.5" />
                Security & Privacy
              </span>
            </motion.div>

            <motion.h1
              className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-50 tracking-tight leading-tight"
              variants={fadeIn}
            >
              Your Patients' Data Never Reaches the AI
            </motion.h1>

            <motion.p
              className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed"
              variants={fadeIn}
            >
              DocAssistAI de-identifies all patient data before sending anything to the AI model.
              If de-identification fails, the system stops. It never proceeds unprotected.
            </motion.p>
          </motion.div>
        </section>

        {/* ─── PII Flow Diagram ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
              How Your Data Flows
            </h2>
            <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-14">
              Every step from recording to final note, with de-identification at the center.
            </p>

            <div className="space-y-0">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                const isLast = index === flowSteps.length - 1;
                return (
                  <div key={step.label + index}>
                    <motion.div
                      className={`flex items-start gap-4 rounded-xl border p-5 ${
                        step.highlight
                          ? 'border-teal-400/30 bg-teal-400/5'
                          : 'border-slate-800 bg-slate-900/60'
                      }`}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.06 }}
                    >
                      <div
                        className={`flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg ${step.bg}`}
                      >
                        <Icon className={`w-5 h-5 ${step.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <h3 className="text-slate-50 font-semibold">{step.label}</h3>
                        </div>
                        <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    </motion.div>

                    {/* Arrow connector */}
                    {!isLast && (
                      <div className="flex justify-center py-1.5">
                        <ArrowDown className="w-4 h-4 text-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ─── Example: Before and After De-identification ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 text-center mb-4">
              What the AI Actually Sees
            </h2>
            <p className="text-slate-400 text-lg text-center max-w-2xl mx-auto mb-12">
              Patient data is replaced with typed tokens before the AI processes anything.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Before */}
              <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h3 className="text-red-400 font-semibold">Original Transcript</h3>
                </div>
                <p className="font-mono text-sm text-slate-300 leading-relaxed">
                  &ldquo;
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">John Smith</span>
                  {' '}is a{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">67-year-old</span>
                  {' '}male presenting on{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">March 10, 2026</span>
                  {' '}with chest pain. MRN{' '}
                  <span className="text-red-300 bg-red-400/10 px-1 rounded">4829103</span>.
                  Patient reports pain started two days ago.&rdquo;
                </p>
              </div>

              {/* After */}
              <div className="rounded-xl border border-teal-400/20 bg-teal-400/5 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  <h3 className="text-teal-400 font-semibold">What the AI Receives</h3>
                </div>
                <p className="font-mono text-sm text-slate-300 leading-relaxed">
                  &ldquo;
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[PERSON_0]</span>
                  {' '}is a{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[AGE_0]</span>
                  {' '}male presenting on{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[DATE_TIME_0]</span>
                  {' '}with chest pain. MRN{' '}
                  <span className="text-teal-300 bg-teal-400/10 px-1 rounded">[MEDICAL_RECORD_NUMBER_0]</span>.
                  Patient reports pain started two days ago.&rdquo;
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500 text-center mt-6">
              After the AI generates the note, tokens are replaced with the original values before the clinician sees the result.
              The mapping exists only in memory for the duration of the request.
            </p>
          </motion.div>
        </section>

        {/* ─── Security Commitments ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
                Our Security Commitments
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Each claim has technical backing in our architecture. This is how we built DocAssistAI.
              </p>
            </motion.div>

            <div className="space-y-6">
              {commitments.map((commitment, index) => {
                const Icon = commitment.icon;
                return (
                  <motion.div
                    key={commitment.title}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.06 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-teal-400/10 mt-0.5">
                        <Icon className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-slate-50 font-semibold text-lg">
                          {commitment.title}
                        </h3>
                        <p className="text-slate-400 text-sm leading-relaxed mt-2">
                          {commitment.detail}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── BAA & Contact ─── */}
        <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
          <motion.div
            className="mx-auto max-w-xl text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-10">
              <Shield className="w-12 h-12 text-teal-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-50 mb-3">
                Need a BAA?
              </h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Business Associate Agreements are available for organizations that require them.
                Contact us to discuss your compliance needs.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/scribe/register"
                  className="bg-teal-400 text-slate-900 rounded-xl px-8 py-3.5 text-base font-semibold hover:bg-teal-300 transition-colors shadow-lg shadow-teal-400/20"
                >
                  Start Free Trial
                </Link>
                <Link
                  to="/privacy"
                  className="border border-slate-600 text-slate-300 rounded-xl px-8 py-3.5 text-base font-medium hover:border-slate-400 hover:text-slate-100 transition-colors"
                >
                  Privacy Policy
                </Link>
              </div>
            </div>

            <p className="mt-8 text-sm text-slate-500 italic">
              Doc Assist AI &mdash; documentation assistance for every doc.
            </p>
          </motion.div>
        </section>
      </main>

      <SegmentFooter />
    </div>
  );
}
