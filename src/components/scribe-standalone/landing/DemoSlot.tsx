import { motion } from 'framer-motion';
import { PlayCircle } from 'lucide-react';
import WaveformAnimation from './WaveformAnimation';

interface DemoSlotProps {
  videoUrl?: string;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/.test(url);
}

export default function DemoSlot({ videoUrl }: DemoSlotProps) {
  const renderMedia = () => {
    if (!videoUrl) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <WaveformAnimation className="w-full h-full" />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <PlayCircle className="h-16 w-16 text-slate-50/30" />
          </div>
        </div>
      );
    }

    if (isYouTubeUrl(videoUrl)) {
      return (
        <iframe
          src={videoUrl}
          title="Demo video"
          className="absolute inset-0 w-full h-full rounded-2xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    return (
      <video
        src={videoUrl}
        className="absolute inset-0 w-full h-full rounded-2xl object-cover"
        controls
      />
    );
  };

  return (
    <section id="demo" className="py-24 px-4 bg-slate-950">
      <motion.div
        className="max-w-4xl mx-auto"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Section heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-slate-50 text-center mb-12">
          See the AI in Action
        </h2>

        {/* Video / animation container */}
        <div className="relative aspect-video rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          {renderMedia()}
        </div>

        {/* Caption */}
        {!videoUrl && (
          <p className="text-sm text-slate-500 text-center mt-4">
            Full demo coming soon
          </p>
        )}
      </motion.div>
    </section>
  );
}
