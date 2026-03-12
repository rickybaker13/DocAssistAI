import { motion } from 'framer-motion';
import { UserMinus, Layers, Building2, DollarSign, Clock, Smartphone } from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentHero from './landing/SegmentHero';
import DemoSlot from './landing/DemoSlot';
import ComparisonTable from './landing/ComparisonTable';
import TrustSignals from './landing/TrustSignals';
import SegmentCTA from './landing/SegmentCTA';
import SegmentFooter from './landing/SegmentFooter';

const painPoints = [
  { stat: '3 roles', label: 'provider, scribe, and coder' },
  { stat: '$99+', label: '/month for competing AI scribes' },
  { stat: '0', label: 'tools built specifically for NPs' },
];

const challenges = [
  {
    icon: UserMinus,
    title: 'No Scribe. No Coder. No MA.',
    description:
      'Sound familiar? You see the patient, you write the note, you assign the codes. There is no support staff handling documentation for you.',
  },
  {
    icon: Layers,
    title: 'Triple-Role Burnout',
    description:
      'Provider, scribe, and billing coder in one. Every additional documentation task compounds the burnout that drives NPs out of clinical practice.',
  },
  {
    icon: Building2,
    title: 'Independent Practice Challenges',
    description:
      'Enterprise AI scribe tools require Epic or Cerner integration. If you run an independent practice, you are locked out of the tools hospitals use.',
  },
  {
    icon: DollarSign,
    title: 'Price vs. Value Mismatch',
    description:
      'Competing AI scribes charge $99\u2013$375/month per provider. For independent NPs, that cost is hard to justify when margins are already thin.',
  },
  {
    icon: Clock,
    title: 'Documentation Eats Clinical Time',
    description:
      'Every minute spent on documentation is a minute not spent with patients. The overhead is real, and it limits how many patients you can see.',
  },
  {
    icon: Smartphone,
    title: 'Need It Everywhere',
    description:
      'From the clinic to telehealth to home visits. NPs need documentation tools that work wherever they practice, not just inside an EHR.',
  },
];

export default function ForNPsPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/for-nps" />

      <main>
        <SegmentHero
          badge="For Nurse Practitioners"
          headline="No Scribe. No Coder. No MA to Help with Notes."
          subheadline="You're the provider, the scribe, and the billing coder. Built by clinicians who understand, DocAssistAI handles documentation — record encounters or paste chart data, with all PHI de-identified before AI processing."
          painPoints={painPoints}
        />

        <DemoSlot />

        {/* ─── NP-Specific Challenges ─── */}
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
                NPs Deserve Better Tools
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                The AI scribe market is built for physicians with enterprise budgets
                and Epic integrations. DocAssistAI works for you, wherever you practice.
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
          headline="Let AI Handle One of Those Three Roles"
          benefits={[
            'AI scribe that writes notes while you see patients',
            'Chart to Note: paste labs, imaging, med lists — no recording needed',
            'Custom templates for any specialty or practice type',
            'HIPAA compliant — all PHI de-identified before AI sees it',
            'Built by clinicians, for clinicians — works on any device',
          ]}
        />
      </main>

      <SegmentFooter />
    </div>
  );
}
