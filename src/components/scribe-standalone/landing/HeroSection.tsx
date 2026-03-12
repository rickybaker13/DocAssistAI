import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import WaveformAnimation from './WaveformAnimation';

const container = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

export default function HeroSection() {
  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center text-center px-4 relative overflow-hidden bg-slate-950">
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.08)_0%,transparent_70%)]" />

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial="hidden"
        animate="visible"
        variants={container}
      >
        {/* Trial badge */}
        <motion.div variants={item}>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-teal-300 mb-6">
            7-Day Free Trial
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-slate-50 tracking-tight max-w-4xl"
          variants={item}
        >
          Clinical Notes.
          <br className="hidden sm:block" />
          Written in Seconds.
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-base md:text-lg lg:text-xl text-slate-400 max-w-2xl mt-6 leading-relaxed"
          variants={item}
        >
          AI-powered medical documentation built by clinicians, for clinicians.
          Record your encounter or paste chart data &mdash; structured clinical notes
          in seconds. All patient data is de-identified before the AI ever sees it.
        </motion.p>

        {/* CTA buttons */}
        <motion.div className="flex flex-row gap-4 mt-10" variants={item}>
          <Link
            to="/scribe/register"
            className="bg-teal-400 text-slate-900 rounded-xl px-8 py-4 text-base font-semibold hover:bg-teal-300 transition-colors shadow-lg shadow-teal-400/20"
          >
            Start Free Trial
          </Link>
          <button
            onClick={scrollToHowItWorks}
            className="border border-slate-600 text-slate-300 rounded-xl px-8 py-4 text-base font-medium hover:border-slate-400 hover:text-slate-100 transition-colors"
          >
            See How It Works
          </button>
        </motion.div>

        {/* Sub-CTA text */}
        <motion.p className="text-sm text-slate-500 mt-4" variants={item}>
          No credit card required &middot; HIPAA compliant &middot; Built by clinicians
        </motion.p>

        {/* Waveform animation */}
        <motion.div className="mt-16 w-full max-w-2xl" variants={item}>
          <WaveformAnimation />
        </motion.div>
      </motion.div>
    </section>
  );
}
