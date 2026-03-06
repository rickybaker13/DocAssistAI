import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Sparkles, CheckCircle2 } from 'lucide-react';

type Phase = 'recording' | 'processing' | 'output';

interface WaveformAnimationProps {
  className?: string;
}

interface BarConfig {
  minScale: number;
  maxScale: number;
  duration: number;
  delay: number;
}

const PHASE_DURATIONS = {
  recording: 3000,
  processing: 2500,
  output: 3500,
} as const;

const PAUSE_BEFORE_LOOP = 1500;

const BAR_COUNT = 24;

const NOTE_SECTIONS = [
  { header: 'HPI', lines: ['80%', '65%'] },
  { header: 'Assessment', lines: ['75%', '90%'] },
  { header: 'Plan', lines: ['85%', '70%'] },
] as const;

function generateBarConfigs(count: number): BarConfig[] {
  const configs: BarConfig[] = [];
  for (let i = 0; i < count; i++) {
    configs.push({
      minScale: 0.15 + Math.random() * 0.25,
      maxScale: 0.6 + Math.random() * 0.4,
      duration: 0.4 + Math.random() * 0.6,
      delay: Math.random() * 0.8,
    });
  }
  return configs;
}

export default function WaveformAnimation({ className }: WaveformAnimationProps) {
  const [phase, setPhase] = useState<Phase>('recording');
  const mountedRef = useRef(true);

  const barConfigs = useMemo(() => generateBarConfigs(BAR_COUNT), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function cycle(currentPhase: Phase) {
      if (!mountedRef.current) return;

      const nextPhaseMap: Record<Phase, Phase> = {
        recording: 'processing',
        processing: 'output',
        output: 'recording',
      };

      const delay =
        currentPhase === 'output'
          ? PHASE_DURATIONS[currentPhase] + PAUSE_BEFORE_LOOP
          : PHASE_DURATIONS[currentPhase];

      timeout = setTimeout(() => {
        if (!mountedRef.current) return;
        const next = nextPhaseMap[currentPhase];
        setPhase(next);
        cycle(next);
      }, delay);
    }

    cycle(phase);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-6 ${className ?? ''}`}
    >
      <AnimatePresence mode="wait">
        {phase === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center"
          >
            {/* Label */}
            <div className="mb-6 flex items-center gap-2 text-sm text-slate-400">
              <Mic className="h-4 w-4 text-teal-400" />
              <span>Recording encounter...</span>
            </div>

            {/* Waveform bars */}
            <div className="flex h-32 items-center justify-center gap-[3px] rounded-xl bg-teal-400/5 px-6">
              {barConfigs.map((bar, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-teal-400"
                  style={{
                    height: '100%',
                    '--min-scale': bar.minScale,
                    '--max-scale': bar.maxScale,
                    animation: `waveform ${bar.duration}s ease-in-out ${bar.delay}s infinite`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </motion.div>
        )}

        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="flex h-32 flex-col items-center justify-center"
          >
            <Sparkles
              className="mb-4 h-8 w-8 text-teal-400"
              style={{ animation: 'spin 3s linear infinite' }}
            />
            <span className="text-sm text-slate-400">
              Generating clinical note...
            </span>
          </motion.div>
        )}

        {phase === 'output' && (
          <motion.div
            key="output"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {NOTE_SECTIONS.map((section, sectionIdx) => (
              <motion.div
                key={section.header}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.4,
                  delay: sectionIdx * 0.2,
                  ease: 'easeOut',
                }}
              >
                <div className="mb-1.5 text-xs font-semibold text-teal-400">
                  {section.header}
                </div>
                <div className="space-y-1.5">
                  {section.lines.map((width, lineIdx) => (
                    <div
                      key={lineIdx}
                      className="h-2 rounded-full bg-slate-700"
                      style={{ width }}
                    />
                  ))}
                </div>
              </motion.div>
            ))}

            {/* Completion indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.4,
                delay: NOTE_SECTIONS.length * 0.2 + 0.3,
              }}
              className="flex items-center gap-2 pt-2 text-sm"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">Note complete — 4.2s</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
