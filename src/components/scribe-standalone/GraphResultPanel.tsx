import React, { useState, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Copy, X, Check, Image, Download } from 'lucide-react';
import DOMPurify from 'dompurify';

interface Props {
  svgMarkup: string | null;
  onClear: () => void;
}

/**
 * Convert a PNG blob to a base64 data-URI string.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Render SVG markup to a 2x-scaled canvas and return the canvas + PNG blob.
 */
async function svgToCanvas(svgMarkup: string): Promise<{ canvas: HTMLCanvasElement; pngBlob: Blob }> {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new window.Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG as image'));
  });

  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = img.naturalWidth * scale;
  canvas.height = img.naturalHeight * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const pngBlob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png')
  );

  return { canvas, pngBlob };
}

/**
 * Copy SVG graph to clipboard using two strategies:
 *
 * 1. Modern Clipboard API  — writes image/png + text/html blobs (works in
 *    most modern apps, Epic Hyperspace, etc.).
 * 2. Legacy execCommand fallback — creates a temporary <img> with a data-URI
 *    src, selects it, and executes document.execCommand('copy'). This goes
 *    through the browser's native clipboard path and maps to CF_DIB / CF_HTML
 *    on Windows, which older editors like Cerner PowerChart DynDoc understand.
 *
 * Strategy 1 is tried first; if it throws (or if the Clipboard API is
 * unavailable), strategy 2 is used as a fallback.
 */
async function copySvgAsImage(svgMarkup: string): Promise<void> {
  const { pngBlob } = await svgToCanvas(svgMarkup);
  const dataUri = await blobToBase64(pngBlob);

  // --- Strategy 1: modern Clipboard API ---
  if (navigator.clipboard?.write) {
    try {
      const htmlSnippet = `<img src="${dataUri}" alt="Chart" style="max-width:100%;" />`;
      const htmlBlob = new Blob([htmlSnippet], { type: 'text/html' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
          'text/html': htmlBlob,
        }),
      ]);
      return;
    } catch {
      // Fall through to legacy approach
    }
  }

  // --- Strategy 2: legacy execCommand with a selected <img> element ---
  // The browser maps the selected HTML (containing the <img>) to CF_HTML on
  // Windows. Older RTF/HTML editors (Cerner PowerChart) read CF_HTML on paste.
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-9999px';
  wrapper.innerHTML = `<img src="${dataUri}" alt="Chart" />`;
  document.body.appendChild(wrapper);

  const range = document.createRange();
  range.selectNodeContents(wrapper);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);

  document.execCommand('copy');
  sel.removeAllRanges();
  document.body.removeChild(wrapper);
}

/**
 * Download the SVG graph as a PNG file. Reliable fallback for EHR systems
 * (e.g. Cerner PowerChart) that reject clipboard image formats — the user
 * can insert the downloaded PNG via the EHR's Insert Image feature.
 */
async function downloadSvgAsPng(svgMarkup: string): Promise<void> {
  const { pngBlob } = await svgToCanvas(svgMarkup);
  const url = URL.createObjectURL(pngBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chart.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const GraphResultPanel: React.FC<Props> = ({ svgMarkup, onClear }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
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

  const handleDownloadPng = useCallback(async () => {
    if (!svgMarkup) return;
    try {
      await downloadSvgAsPng(svgMarkup);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2000);
    } catch {
      // silent — nothing useful to show the user here
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
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600 hover:text-slate-100 transition-colors"
            >
              {downloaded ? <Check size={12} className="text-emerald-400" /> : <Download size={12} />}
              {downloaded ? 'Saved!' : 'Download PNG'}
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
          <p className="text-[10px] text-slate-500 mt-1.5">If Copy doesn't work in your EHR, download the PNG and use Insert Image.</p>
        </div>
      )}
    </div>
  );
};

export default GraphResultPanel;
