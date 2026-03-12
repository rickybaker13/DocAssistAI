import { motion } from 'framer-motion';
import { Mic, Sparkles, FileCheck } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: Mic,
    title: 'Record or Paste',
    description:
      'Speak naturally during the encounter, or paste chart data — labs, imaging, med lists, consult notes. Two paths, same result.',
  },
  {
    number: '2',
    icon: Sparkles,
    title: 'AI Generates',
    description:
      'Choose your note type and sections. All patient data is de-identified before the AI processes anything. Your PHI never reaches the model.',
  },
  {
    number: '3',
    icon: FileCheck,
    title: 'Review & Finalize',
    description:
      'Edit inline, use AI suggestions with guideline citations, then finalize with one click.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-4">
      {/* Heading */}
      <h2 className="text-3xl md:text-4xl font-bold text-slate-50 text-center mb-4">
        How It Works
      </h2>
      <p className="text-base text-slate-400 text-center max-w-xl mx-auto mb-16">
        Three simple steps from encounter to finished note.
      </p>

      {/* Steps container */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative">
        {/* Connecting dashed line (desktop only) */}
        <div className="hidden md:block absolute top-[60px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] border-t-2 border-dashed border-teal-400/20" />

        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.number}
              className="relative text-center space-y-4"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
            >
              {/* Step number circle */}
              <div className="w-14 h-14 mx-auto bg-teal-400 rounded-full flex items-center justify-center text-slate-900 font-bold text-lg relative z-10">
                {step.number}
              </div>

              {/* Icon */}
              <div className="flex justify-center mt-4">
                <Icon className="h-7 w-7 text-teal-400" />
              </div>

              {/* Title */}
              <h3 className="text-xl font-semibold text-slate-50 mt-3">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
