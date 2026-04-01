import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Stethoscope, HeartPulse, GraduationCap, Building2, Shield } from 'lucide-react';

const segments = [
  {
    icon: Stethoscope,
    title: 'Physician Assistants',
    description: '14 patients, 14 notes, 2 extra hours. Every single day. DocAssistAI gives you your evenings back.',
    link: '/for-pas',
    linkLabel: 'See the PA page',
  },
  {
    icon: HeartPulse,
    title: 'Nurse Practitioners',
    description: 'No scribe. No coder. No MA to help with notes. You deserve better tools at a price that makes sense.',
    link: '/for-nps',
    linkLabel: 'See the NP page',
  },
  {
    icon: GraduationCap,
    title: 'Residents & Students',
    description: '80-hour weeks are hard enough without charting until 2 AM. Generate notes in seconds on any device.',
    link: '/for-residents',
    linkLabel: 'See the Residents page',
  },
  {
    icon: Building2,
    title: 'Practices & Programs',
    description: 'Your providers spend 40% of their day on documentation. That is recoverable time. No IT integration required.',
    link: '/for-practices',
    linkLabel: 'See the Practices page',
  },
];

export default function WhoItsForSection() {
  return (
    <>
      {/* ─── Who It's For ─── */}
      <section id="who-its-for" className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 tracking-tight mb-4">
              Built for Every Clinician
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Whether you are a PA in the ER, an NP in primary care, a resident on night float, or a practice director watching your providers burn out &mdash; DocAssistAI was made for you.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {segments.map((seg, index) => {
              const Icon = seg.icon;
              return (
                <motion.div
                  key={seg.title}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col"
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-400/10 mb-4">
                    <Icon className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-slate-50 font-bold text-lg mb-2">{seg.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed flex-grow">{seg.description}</p>
                  <Link
                    to={seg.link}
                    className="mt-4 text-teal-400 text-sm font-medium hover:text-teal-300 transition-colors"
                  >
                    {seg.linkLabel} &rarr;
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Security & Privacy ─── */}
      <section className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 sm:p-12">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              <div className="flex-shrink-0">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-400/10">
                  <Shield className="w-8 h-8 text-teal-400" />
                </div>
              </div>

              <div className="text-center sm:text-left flex-grow">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-50 mb-3">
                  Your Patients&rsquo; Data Never Reaches the AI
                </h2>
                <p className="text-slate-400 leading-relaxed mb-1">
                  All patient names, dates, MRNs, and identifiers are automatically stripped out before anything is sent to the AI model. If the de-identification system is down, DocAssistAI stops entirely &mdash; it never proceeds unprotected.
                </p>
                <p className="text-slate-500 text-sm">
                  HIPAA-compliant architecture. BAAs available. No PHI stored or logged. No data used for AI training.
                </p>
              </div>

              <div className="flex-shrink-0">
                <Link
                  to="/security"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-400/30 bg-teal-400/10 px-6 py-3 text-sm font-semibold text-teal-300 hover:bg-teal-400/20 transition-colors whitespace-nowrap"
                >
                  <Shield className="w-4 h-4" />
                  Security &amp; Privacy
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </>
  );
}
