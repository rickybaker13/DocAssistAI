import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export interface PainPoint {
  stat: string;
  label: string;
}

interface SegmentHeroProps {
  badge: string;
  headline: string;
  subheadline: string;
  painPoints: PainPoint[];
  ctaText?: string;
}

export default function SegmentHero({
  badge,
  headline,
  subheadline,
  painPoints,
  ctaText = 'Start Free Trial',
}: SegmentHeroProps) {
  return (
    <section className="relative overflow-hidden bg-slate-950 px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
      {/* Radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.08)_0%,transparent_70%)]" />

      <motion.div
        className="relative z-10 mx-auto max-w-4xl text-center"
        initial="hidden"
        animate="visible"
        variants={container}
      >
        {/* Badge */}
        <motion.div variants={item}>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-300 mb-6">
            {badge}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-50 tracking-tight leading-tight"
          variants={item}
        >
          {headline}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-base sm:text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed"
          variants={item}
        >
          {subheadline}
        </motion.p>

        {/* Pain point stats */}
        <motion.div
          className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto"
          variants={item}
        >
          {painPoints.map((point) => (
            <div
              key={point.label}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-5"
            >
              <div className="text-3xl sm:text-4xl font-bold text-teal-400 mb-1">
                {point.stat}
              </div>
              <div className="text-sm text-slate-400">{point.label}</div>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" variants={item}>
          <Link
            to="/scribe/register"
            className="bg-teal-400 text-slate-900 rounded-xl px-8 py-4 text-base font-semibold hover:bg-teal-300 transition-colors shadow-lg shadow-teal-400/20"
          >
            {ctaText}
          </Link>
          <Link
            to="/security"
            className="border border-slate-600 text-slate-300 rounded-xl px-8 py-4 text-base font-medium hover:border-slate-400 hover:text-slate-100 transition-colors"
          >
            How We Protect Your Data
          </Link>
        </motion.div>

        {/* Sub-CTA */}
        <motion.p className="text-sm text-slate-500 mt-4" variants={item}>
          No credit card required &middot; HIPAA compliant
        </motion.p>
      </motion.div>
    </section>
  );
}
