import { motion } from 'framer-motion';
import { Clock, FileText, Clipboard, Stethoscope, Zap, PenLine } from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentHero from './landing/SegmentHero';
import DemoSlot from './landing/DemoSlot';
import ComparisonTable from './landing/ComparisonTable';
import TrustSignals from './landing/TrustSignals';
import SegmentCTA from './landing/SegmentCTA';
import SegmentFooter from './landing/SegmentFooter';

const painPoints = [
  { stat: '14+', label: 'patients seen per day' },
  { stat: '2 hrs', label: 'extra charting every night' },
  { stat: '40%', label: 'of your day on documentation' },
];

const challenges = [
  {
    icon: Clock,
    title: 'Charting After Hours',
    description:
      'You finished your last patient at 5 PM. You finished your last note at 9 PM. Every. Single. Day.',
  },
  {
    icon: FileText,
    title: 'Copy-Paste Fatigue',
    description:
      'You copy your own notes because retyping them takes too long. Templates help, but they still need heavy editing.',
  },
  {
    icon: Clipboard,
    title: 'No Scribe, No Support',
    description:
      'Physicians get scribes. You get a keyboard. PAs write more notes than anyone and get the least support doing it.',
  },
  {
    icon: Stethoscope,
    title: 'RVU Pressure',
    description:
      'See more patients, write more notes, generate more revenue. The documentation burden scales with the expectation.',
  },
  {
    icon: Zap,
    title: '$600+/mo Enterprise Scribes',
    description:
      'The AI scribes that hospitals adopt are enterprise products priced for physicians. PAs rarely get access.',
  },
  {
    icon: PenLine,
    title: 'The ROS and PE Grind',
    description:
      'Typing the same normal ROS and PE template 14 times a day. DocAssistAI starts with normal baselines and replaces only what changed.',
  },
];

export default function ForPAsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/for-pas" />

      <main>
        <SegmentHero
          badge="For Physician Assistants"
          headline="You Didn't Go to PA School to Chart Until 9 PM"
          subheadline="DocAssistAI listens to your patient encounter and generates a structured clinical note in seconds. Your patient data is de-identified before the AI ever sees it."
          painPoints={painPoints}
        />

        {/* Demo slot */}
        <DemoSlot />

        {/* ─── PA-Specific Challenges ─── */}
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
                Built for How PAs Actually Work
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                PAs see the most patients and write the most notes. Nobody else
                is building AI documentation tools for you. We are.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map((challenge, index) => {
                const Icon = challenge.icon;
                return (
                  <motion.div
                    key={challenge.title}
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
                      {challenge.title}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {challenge.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <ComparisonTable />
        <TrustSignals />
        <SegmentCTA
          headline="Stop Charting After Hours"
          benefits={[
            '7 note types including SOAP, H&P, and Procedure notes',
            '72+ customizable sections across 10 categories',
            'Normal PE and ROS templates that update by exception',
            'Works on any device — no EHR integration required',
            'HIPAA compliant with PII de-identification',
          ]}
        />
      </main>

      <SegmentFooter />
    </div>
  );
}
