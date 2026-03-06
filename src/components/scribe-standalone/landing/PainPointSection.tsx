import { motion } from 'framer-motion';
import { Clock, XCircle, Sparkles, CheckCircle2 } from 'lucide-react';

const oldWayItems = [
  'Spend 15+ minutes writing each note',
  'Toggle between systems for templates',
  'Risk missing critical documentation',
  'End your shift still catching up',
];

const newWayItems = [
  'Speak naturally during the encounter',
  'AI generates your note in seconds',
  'Review and refine with AI suggestions',
  'Finalize and move on to the next patient',
];

export default function PainPointSection() {
  return (
    <section className="py-24 px-4">
      {/* Section heading */}
      <h2 className="text-3xl md:text-4xl font-bold text-slate-50 text-center mb-4">
        Documentation Shouldn&apos;t Be a Burden
      </h2>
      <p className="text-base text-slate-400 text-center max-w-2xl mx-auto mb-16">
        See how DocAssistAI transforms the documentation process from a
        time-consuming chore into an effortless workflow.
      </p>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left card — The Old Way */}
        <motion.div
          className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-red-400" />
            <span className="text-lg font-semibold text-slate-200">
              The Old Way
            </span>
          </div>

          {/* Mock editor visual */}
          <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-3">
            {/* Title line */}
            <div className="h-4 w-40 rounded bg-slate-700" />

            {/* Skeleton lines */}
            <div className="h-3 rounded bg-slate-800" style={{ width: '90%' }} />
            <div className="h-3 rounded bg-slate-800" style={{ width: '75%' }} />
            <div className="h-3 rounded bg-slate-800" style={{ width: '85%' }} />
            <div className="flex items-center gap-1">
              <div
                className="h-3 rounded bg-slate-800 animate-pulse"
                style={{ width: '60%' }}
              />
              <span className="inline-block w-0.5 h-4 bg-slate-500 animate-pulse" />
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-red-500/60 w-[23%]" />
            </div>
            <p className="text-xs text-slate-600">~15 min per note</p>
          </div>

          {/* Bullet list */}
          <ul className="space-y-3">
            {oldWayItems.map((text, index) => (
              <motion.li
                key={text}
                className="flex items-start gap-2"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.3 }}
              >
                <XCircle className="h-4 w-4 text-red-400/60 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-400">{text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Right card — With DocAssistAI */}
        <motion.div
          className="bg-slate-900 border border-teal-400/20 rounded-2xl p-8 space-y-6"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-teal-400" />
            <span className="text-lg font-semibold text-slate-200">
              With DocAssistAI
            </span>
          </div>

          {/* Mock note output visual */}
          <div className="rounded-lg bg-slate-950 border border-teal-400/10 p-4 space-y-3">
            {/* HPI section */}
            <div>
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1.5">
                HPI
              </p>
              <div className="space-y-1.5">
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '80%' }}
                />
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '65%' }}
                />
              </div>
            </div>

            {/* Assessment section */}
            <div>
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1.5">
                Assessment
              </p>
              <div className="space-y-1.5">
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '75%' }}
                />
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '90%' }}
                />
              </div>
            </div>

            {/* Plan section */}
            <div>
              <p className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-1.5">
                Plan
              </p>
              <div className="space-y-1.5">
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '85%' }}
                />
                <div
                  className="h-2.5 rounded bg-teal-400/20"
                  style={{ width: '70%' }}
                />
              </div>
            </div>

            {/* Completion bar */}
            <div className="h-2 rounded-full bg-teal-400/20">
              <div className="h-2 rounded-full bg-teal-400 w-full" />
            </div>
            <p className="text-xs text-teal-400/60">Generated in 4.2 seconds</p>
          </div>

          {/* Bullet list */}
          <ul className="space-y-3">
            {newWayItems.map((text, index) => (
              <motion.li
                key={text}
                className="flex items-start gap-2"
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <CheckCircle2 className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-300">{text}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  );
}
