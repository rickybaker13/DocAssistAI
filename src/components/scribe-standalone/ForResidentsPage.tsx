import { motion } from 'framer-motion';
import { Moon, BookOpen, UserCheck, Timer, GraduationCap, Layers } from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentHero from './landing/SegmentHero';
import DemoSlot from './landing/DemoSlot';
import ComparisonTable from './landing/ComparisonTable';
import TrustSignals from './landing/TrustSignals';
import SegmentCTA from './landing/SegmentCTA';
import SegmentFooter from './landing/SegmentFooter';

const painPoints = [
  { stat: '80 hrs', label: 'per week in residency' },
  { stat: '5+ hrs', label: 'daily on documentation' },
  { stat: '#1', label: 'cause of trainee burnout' },
];

const challenges = [
  {
    icon: Moon,
    title: 'Charting Until 2 AM',
    description:
      'You finish rounds, then spend hours finishing notes. The learning happens during the encounter. The typing happens after everyone else goes home.',
  },
  {
    icon: UserCheck,
    title: 'Attending Expectations',
    description:
      'Your attending is going to read your note. It needs to be thorough, properly formatted, and clinically sound. The pressure to get it right adds time.',
  },
  {
    icon: BookOpen,
    title: 'Learning Documentation Standards',
    description:
      'Medical school teaches medicine, not documentation. Learning what belongs in an H&P versus a progress note versus a discharge summary takes months of practice.',
  },
  {
    icon: Timer,
    title: 'Volume Without Efficiency Tools',
    description:
      'Residents carry patient panels and write notes for all of them. Without smart templates or AI assistance, the volume is crushing.',
  },
  {
    icon: GraduationCap,
    title: 'Students Need Structured Examples',
    description:
      'Medical students benefit from seeing well-structured notes for each type of encounter. AI-generated drafts serve as learning templates for documentation skills.',
  },
  {
    icon: Layers,
    title: 'Multiple Note Types, One Rotation',
    description:
      'H&Ps, progress notes, procedure notes, discharge summaries, consult notes \u2014 all within the same rotation. Each has different requirements.',
  },
];

export default function ForResidentsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/for-residents" />

      <main>
        <SegmentHero
          badge="For Residents & Medical Students"
          headline="80-Hour Weeks Are Hard Enough Without Charting Until 2 AM"
          subheadline="DocAssistAI generates structured clinical notes from your patient encounters. Learn documentation by reviewing AI-generated drafts, not by typing from scratch at midnight."
          painPoints={painPoints}
        />

        <DemoSlot />

        {/* ─── Resident-Specific Challenges ─── */}
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
                Built for the Training Environment
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Residency should be about learning medicine, not typing notes.
                DocAssistAI helps you document efficiently so you can focus on your education.
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
          headline="Your Attending Is Going to Read Your Note. Make It Good."
          benefits={[
            '7 note types covering every rotation documentation need',
            'AI generates structured drafts you review and refine',
            'Normal PE and ROS baselines built in — no retyping templates',
            'Works on your phone between rounds',
            'Free trial — no credit card, no commitment',
          ]}
        />
      </main>

      <SegmentFooter />
    </div>
  );
}
