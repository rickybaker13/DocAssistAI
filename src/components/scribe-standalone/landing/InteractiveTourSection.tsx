import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Smartphone,
  Monitor,
  FileText,
  Sparkles,
  ArrowRight,
  Receipt,
} from 'lucide-react';

/* ── Scene definitions ── */

const SCENES = [
  { key: 'record', label: 'Record', icon: Mic },
  { key: 'generate', label: 'AI Notes', icon: Sparkles },
  { key: 'review', label: 'Review', icon: FileText },
  { key: 'billing', label: 'Billing', icon: Receipt },
] as const;

type SceneKey = (typeof SCENES)[number]['key'];

const AUTO_ADVANCE_MS = 6000;

/* ── Bar config for waveform ── */

interface BarConfig { minScale: number; maxScale: number; duration: number; delay: number }

function generateBars(n: number): BarConfig[] {
  const bars: BarConfig[] = [];
  for (let i = 0; i < n; i++) {
    bars.push({
      minScale: 0.15 + Math.random() * 0.25,
      maxScale: 0.6 + Math.random() * 0.4,
      duration: 0.4 + Math.random() * 0.6,
      delay: Math.random() * 0.8,
    });
  }
  return bars;
}

/* ── Device frames ── */

function PhoneFrame({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={`relative mx-auto w-[180px] sm:w-[200px] rounded-[24px] border-2 ${
        active ? 'border-teal-400/40' : 'border-slate-700'
      } bg-slate-900 p-2 transition-colors duration-500 shadow-lg`}
    >
      {/* Notch */}
      <div className="mx-auto mb-1.5 h-1.5 w-12 rounded-full bg-slate-700" />
      <div className="relative rounded-[16px] bg-slate-950 overflow-hidden" style={{ minHeight: 260 }}>
        {children}
      </div>
      {/* Home bar */}
      <div className="mx-auto mt-1.5 h-1 w-10 rounded-full bg-slate-700" />
    </div>
  );
}

function LaptopFrame({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Screen */}
      <div
        className={`rounded-t-xl border-2 ${
          active ? 'border-teal-400/40' : 'border-slate-700'
        } bg-slate-900 p-1.5 transition-colors duration-500 shadow-lg`}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800 rounded-t-lg">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
            <div className="w-2 h-2 rounded-full bg-amber-400/60" />
            <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
          </div>
          <div className="flex-1 mx-2 h-4 rounded bg-slate-700/50 flex items-center px-2">
            <span className="text-[8px] text-slate-500 truncate">docassistai.app</span>
          </div>
        </div>
        <div className="relative bg-slate-950 rounded-b-lg overflow-hidden" style={{ minHeight: 240 }}>
          {children}
        </div>
      </div>
      {/* Keyboard base */}
      <div className="h-3 rounded-b-xl bg-slate-700 border-x-2 border-b-2 border-slate-600 mx-2" />
    </div>
  );
}

/* ── Scene content components ── */

function RecordScene({ bars }: { bars: BarConfig[] }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4" style={{ minHeight: 240 }}>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
        <Mic className="h-3.5 w-3.5 text-teal-400" />
        <span>Recording...</span>
      </div>
      <div className="flex h-16 items-center justify-center gap-[2px] rounded-lg bg-teal-400/5 px-4">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="w-[2px] rounded-full bg-teal-400"
            style={{
              height: '100%',
              '--min-scale': bar.minScale,
              '--max-scale': bar.maxScale,
              animation: `waveform ${bar.duration}s ease-in-out ${bar.delay}s infinite`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-red-500/80 flex items-center justify-center">
          <div className="w-3 h-3 rounded-sm bg-white" />
        </div>
        <span className="text-[10px] text-slate-500">02:34</span>
      </div>
    </div>
  );
}

const CONFIDENCE_SECTIONS = [
  { name: 'HPI', confidence: 0.94, color: 'teal' },
  { name: 'Assessment', confidence: 0.87, color: 'teal' },
  { name: 'ROS', confidence: 0.62, color: 'amber' },
  { name: 'Plan', confidence: 0.91, color: 'teal' },
];

function GenerateScene() {
  return (
    <div className="p-3 space-y-2" style={{ minHeight: 240 }}>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-teal-400" />
        <span>Note generated</span>
      </div>
      {CONFIDENCE_SECTIONS.map((sec, i) => {
        const pct = Math.round(sec.confidence * 100);
        const badgeClass =
          sec.color === 'teal'
            ? 'bg-teal-950 text-teal-400 border-teal-400/30'
            : 'bg-amber-950 text-amber-400 border-amber-400/30';
        const borderClass =
          sec.color === 'teal' ? 'border-l-teal-400' : 'border-l-amber-400';
        return (
          <motion.div
            key={sec.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.15 }}
            className={`rounded-lg bg-slate-800/80 p-2 border-l-2 ${borderClass}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                {sec.name}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${badgeClass}`}>
                {pct}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-slate-700" style={{ width: '85%' }} />
              <div className="h-1.5 rounded-full bg-slate-700" style={{ width: '60%' }} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ReviewScene() {
  return (
    <div className="p-3 space-y-2" style={{ minHeight: 240 }}>
      {/* Mock note section */}
      <div className="rounded-lg bg-slate-800/80 p-2 border-l-2 border-l-teal-400">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">Assessment</span>
        <div className="mt-1 space-y-1">
          <div className="h-1.5 rounded-full bg-slate-700" style={{ width: '90%' }} />
          <div className="h-1.5 rounded-full bg-slate-700" style={{ width: '70%' }} />
        </div>
      </div>

      {/* AI suggestion panel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-lg border border-teal-400/20 bg-teal-950/30 p-2.5"
      >
        <div className="flex items-center gap-1 text-[10px] text-teal-400 font-medium mb-2">
          <Sparkles className="h-3 w-3" />
          AI Suggestions
        </div>

        {[
          'Add laterality to fracture diagnosis',
          'Include weight-bearing status in plan',
        ].map((sug, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.2 }}
            className="flex items-center justify-between py-1.5 border-t border-slate-700/50"
          >
            <span className="text-[9px] text-slate-300 flex-1">{sug}</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-teal-400 text-slate-900 font-semibold ml-2 whitespace-nowrap flex items-center gap-0.5">
              Add <ArrowRight className="h-2 w-2" />
            </span>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-1.5 text-[8px] text-slate-500 italic"
        >
          Per AHA (2024) guidelines
        </motion.div>
      </motion.div>
    </div>
  );
}

const MOCK_ICD = [
  { code: 'S82.001A', desc: 'Fracture of right tibia, initial', conf: 0.95 },
  { code: 'M79.3', desc: 'Panniculitis, unspecified', conf: 0.72 },
  { code: 'Z87.39', desc: 'History of musculoskeletal disease', conf: 0.88 },
];

const MOCK_CPT = [
  { code: '99223', desc: 'Initial hospital care, high complexity', conf: 0.90 },
];

function BillingScene() {
  return (
    <div className="p-3 space-y-2" style={{ minHeight: 240 }}>
      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
        <Receipt className="h-3.5 w-3.5 text-teal-400" />
        <span>Suggested Codes</span>
      </div>

      {/* ICD-10 */}
      <div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">ICD-10</span>
        {MOCK_ICD.map((item, i) => (
          <motion.div
            key={item.code}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.12 }}
            className="flex items-center justify-between py-1.5 border-b border-slate-800/60"
          >
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-teal-400">{item.code}</span>
              <p className="text-[9px] text-slate-400 truncate">{item.desc}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium border bg-teal-950 text-teal-400 border-teal-400/30 ml-2">
              {Math.round(item.conf * 100)}%
            </span>
          </motion.div>
        ))}
      </div>

      {/* CPT */}
      <div>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">CPT</span>
        {MOCK_CPT.map((item, i) => (
          <motion.div
            key={item.code}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + i * 0.12 }}
            className="flex items-center justify-between py-1.5 border-b border-slate-800/60"
          >
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-teal-400">{item.code}</span>
              <p className="text-[9px] text-slate-400 truncate">{item.desc}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium border bg-teal-950 text-teal-400 border-teal-400/30 ml-2">
              {Math.round(item.conf * 100)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Captions per scene ── */

const CAPTIONS: Record<SceneKey, { device: 'phone' | 'laptop' | 'both'; headline: string; body: string }> = {
  record: {
    device: 'phone',
    headline: 'Record anywhere',
    body: 'Start recording on your phone at the bedside, in clinic, or on rounds. Pick it up later on your laptop to review and finalize.',
  },
  generate: {
    device: 'laptop',
    headline: 'AI confidence scores',
    body: 'Each section shows a confidence percentage — how well the content is supported by your transcript. Green means well-supported, amber means partially inferred.',
  },
  review: {
    device: 'laptop',
    headline: 'AI-powered review',
    body: 'Get clinically relevant suggestions backed by guideline citations. Add them to your note with one click, or skip what you don\'t need.',
  },
  billing: {
    device: 'laptop',
    headline: 'Billing & coding',
    body: 'ICD-10 and CPT codes are suggested automatically from your note content, each with a confidence score and supporting text.',
  },
};

/* ── Main component ── */

export default function InteractiveTourSection() {
  const [activeScene, setActiveScene] = useState<SceneKey>('record');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const bars = useMemo(() => generateBars(18), []);

  // Auto-advance
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setActiveScene((prev) => {
        const idx = SCENES.findIndex((s) => s.key === prev);
        return SCENES[(idx + 1) % SCENES.length].key;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [activeScene]);

  const handleTabClick = (key: SceneKey) => {
    clearTimeout(timerRef.current);
    setActiveScene(key);
  };

  const caption = CAPTIONS[activeScene];
  const showPhone = caption.device === 'phone' || caption.device === 'both';
  const showLaptop = caption.device === 'laptop' || caption.device === 'both';

  const sceneContent = (
    <AnimatePresence mode="wait">
      {activeScene === 'record' && (
        <motion.div key="record" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <RecordScene bars={bars} />
        </motion.div>
      )}
      {activeScene === 'generate' && (
        <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <GenerateScene />
        </motion.div>
      )}
      {activeScene === 'review' && (
        <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <ReviewScene />
        </motion.div>
      )}
      {activeScene === 'billing' && (
        <motion.div key="billing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
          <BillingScene />
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <section className="py-24 px-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto"
      >
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-slate-50 text-center mb-3">
          See It in Action
        </h2>
        <p className="text-base text-slate-400 text-center max-w-xl mx-auto mb-12">
          Record on your phone, finish on your laptop — your notes sync across devices.
        </p>

        {/* Tabs */}
        <div className="flex justify-center gap-1 sm:gap-2 mb-10">
          {SCENES.map((scene) => {
            const Icon = scene.icon;
            const isActive = activeScene === scene.key;
            return (
              <button
                key={scene.key}
                onClick={() => handleTabClick(scene.key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'bg-teal-400 text-slate-900 shadow-lg shadow-teal-400/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{scene.label}</span>
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="max-w-xs mx-auto mb-10 h-0.5 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            key={activeScene}
            className="h-full bg-teal-400/60 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
          />
        </div>

        {/* Content area: device + caption side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          {/* Device mockup */}
          <div className="flex justify-center items-center gap-4">
            <AnimatePresence mode="wait">
              {showPhone && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                >
                  <PhoneFrame active>
                    {activeScene === 'record' ? sceneContent : null}
                  </PhoneFrame>
                </motion.div>
              )}
              {showPhone && showLaptop && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-slate-600"
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.div>
              )}
              {showLaptop && (
                <motion.div
                  key="laptop"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                >
                  <LaptopFrame active>
                    {activeScene !== 'record' ? sceneContent : null}
                  </LaptopFrame>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Caption */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScene}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35 }}
              className="text-center md:text-left"
            >
              {/* Device indicator */}
              <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                {showPhone && <Smartphone className="h-4 w-4 text-teal-400" />}
                {showPhone && showLaptop && <span className="text-slate-600">+</span>}
                {showLaptop && <Monitor className="h-4 w-4 text-teal-400" />}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-50 mb-3">
                {caption.headline}
              </h3>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-sm mx-auto md:mx-0">
                {caption.body}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </section>
  );
}
