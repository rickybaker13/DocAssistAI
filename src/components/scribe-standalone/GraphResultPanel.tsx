import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Copy, X, Check, Image } from 'lucide-react';
import DOMPurify from 'dompurify';

interface Props {
  svgMarkup: string | null;
  onClear: () => void;
}

async function copySvgAsImage(svgMarkup: string): Promise<void> {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new window.Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG as image'));
  });

  const canvas = document.createElement('canvas');
  // Use 2x for crisp output
  const scale = 2;
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png')
  );
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export const GraphResultPanel: React.FC<Props> = ({ svgMarkup, onClear }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCopyImage = useCallback(async () => {
    if (!svgMarkup) return;
    try {
      await copySvgAsImage(svgMarkup);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy SVG as text
      await navigator.clipboard.writeText(svgMarkup);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [svgMarkup]);

  if (!svgMarkup) return null;

  // Sanitize SVG with DOMPurify to prevent XSS — this is safe to render
  const sanitized = DOMPurify.sanitize(svgMarkup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['svg'],
  });

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Image size={14} className="text-teal-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chart</span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronUp size={14} className="text-slate-500" />}
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {/* SVG container — content sanitized by DOMPurify above */}
          <div
            ref={containerRef}
            className="bg-white rounded-lg p-2 mb-3 flex items-center justify-center overflow-auto"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 hover:text-slate-100 transition-colors"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy as Image'}
            </button>
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphResultPanel;
