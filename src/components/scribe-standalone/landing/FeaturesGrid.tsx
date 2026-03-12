import { motion } from 'framer-motion';
import {
  FileText,
  Sliders,
  Layout,
  Sparkles,
  Library,
  MessageSquare,
  Smartphone,
  Shield,
  ClipboardPaste,
} from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: '7 Note Types',
    description:
      'SOAP, H&P, Progress, Procedure, Discharge, Consult, and Custom note formats to match any clinical workflow.',
  },
  {
    icon: ClipboardPaste,
    title: 'Chart to Note',
    description:
      'Paste labs, imaging, med lists, and consult notes — the AI synthesizes chart data into a structured clinical note. No recording needed.',
  },
  {
    icon: Sliders,
    title: '4 Verbosity Levels',
    description:
      'Concise, Brief, Standard, or Detailed output. From telegraphic surgical shorthand to comprehensive clinical prose.',
  },
  {
    icon: Layout,
    title: 'Smart Templates',
    description:
      'Specialty-specific templates that adapt to your practice area, pre-loaded with the sections and language you need.',
  },
  {
    icon: Sparkles,
    title: 'AI Section Editor',
    description:
      'AI-assisted editing with guideline citations. Refine, expand, or rewrite any section with intelligent suggestions.',
  },
  {
    icon: Library,
    title: 'Section Library',
    description:
      'Save and reuse note sections across patients. Build a personal library of your best documentation blocks.',
  },
  {
    icon: MessageSquare,
    title: 'AI Chat Assistant',
    description:
      'Ask questions about your note or request changes — all through a conversational interface.',
  },
  {
    icon: Smartphone,
    title: 'Works Everywhere',
    description:
      'Progressive Web App that runs on any device. Mobile-friendly design so you can document from anywhere.',
  },
  {
    icon: Shield,
    title: 'HIPAA-Compliant Architecture',
    description:
      'All patient data is de-identified by Microsoft Presidio before reaching the AI. Fail-closed design, TLS encryption, and no PHI stored or logged.',
  },
];

export default function FeaturesGrid() {
  return (
    <section id="features" className="bg-slate-950 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-50 mb-4">
            Everything You Need
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Built by clinicians who know the documentation grind firsthand.
            Record encounters or paste chart data &mdash; faster, smarter notes
            without sacrificing quality or patient privacy.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
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
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
