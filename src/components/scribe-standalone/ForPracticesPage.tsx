import { motion } from 'framer-motion';
import { TrendingDown, DollarSign, Users, BarChart3, Building, Clock } from 'lucide-react';
import SegmentNav from './landing/SegmentNav';
import SegmentHero from './landing/SegmentHero';
import DemoSlot from './landing/DemoSlot';
import ComparisonTable from './landing/ComparisonTable';
import TrustSignals from './landing/TrustSignals';
import SegmentCTA from './landing/SegmentCTA';
import SegmentFooter from './landing/SegmentFooter';

const painPoints = [
  { stat: '40%', label: 'of clinical day lost to documentation' },
  { stat: '$600+', label: '/provider/month for enterprise scribes' },
  { stat: '50%+', label: 'physician burnout rate' },
];

const challenges = [
  {
    icon: TrendingDown,
    title: 'Provider Burnout Is a Retention Problem',
    description:
      'Documentation burden is the number one driver of clinician burnout. Burned-out providers leave. Replacing a physician costs $500K\u2013$1M.',
  },
  {
    icon: DollarSign,
    title: 'Enterprise Scribe Pricing',
    description:
      'The established AI scribes charge $600\u2013$900 per provider per month with multi-year contracts. For a 10-provider group, that is $72K\u2013$108K per year.',
  },
  {
    icon: Users,
    title: 'PAs and NPs Are Underserved',
    description:
      'Enterprise scribes are built for physicians with Epic. Your PAs and NPs — who write the most notes — often get no AI assistance at all.',
  },
  {
    icon: BarChart3,
    title: 'Documentation Quality Affects Revenue',
    description:
      'Better notes mean better coding, fewer claim denials, and higher RVU capture. When providers rush through documentation, revenue leaks.',
  },
  {
    icon: Building,
    title: 'EHR Lock-In',
    description:
      'Most enterprise scribes require Epic or Cerner integration. If your practice runs a different EHR — or multiple EHRs — you are locked out.',
  },
  {
    icon: Clock,
    title: 'Recoverable Time',
    description:
      'If each provider saves 1\u20132 hours per day on documentation, that is 1\u20132 additional patients seen. At scale, this recovers significant revenue.',
  },
];

export default function ForPracticesPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <SegmentNav active="/for-practices" />

      <main>
        <SegmentHero
          badge="For Attendings & Practice Leaders"
          headline="Your Providers Spend 40% of Their Day on Documentation"
          subheadline="That is recoverable time. Built by clinicians who understand the documentation burden. DocAssistAI generates notes from recordings or pasted chart data — with all PHI de-identified before anything reaches the AI."
          painPoints={painPoints}
        />

        <DemoSlot />

        {/* ─── Practice-Level Challenges ─── */}
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
                Better Notes. Less Burnout. More Revenue.
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Give every provider in your practice access to AI documentation —
                without the enterprise price tag or EHR lock-in.
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
          headline="One Tool for Every Provider in Your Practice"
          benefits={[
            'Works for physicians, PAs, NPs, and all clinical staff',
            'Chart to Note: providers paste chart data — AI builds discharge summaries, consults, and more',
            'HIPAA compliant — Microsoft Presidio de-identifies all PHI before AI processing',
            'Built by clinicians, for clinicians — no EHR integration required',
            'Free to pilot — evaluate before committing budget',
          ]}
        />
      </main>

      <SegmentFooter />
    </div>
  );
}
