import React, { useEffect, useRef } from 'react';
import { Match } from '../../hooks/useCodingHighlights';

interface Props {
  match: Match;
  position: { x: number; y: number };
  onReplace: (preferred: string) => void;
  onDismiss: () => void;
}

export const CodingTermPopover: React.FC<Props> = ({ match, position, onReplace, onDismiss }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onDismiss]);

  const leftPos = Math.max(8, Math.min(position.x - 8, window.innerWidth - 320));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`ICD-10 term suggestion for "${match.original}"`}
      style={{ position: 'fixed', left: leftPos, top: position.y + 12, zIndex: 60, width: 300 }}
      className="bg-white border border-amber-200 rounded-xl shadow-xl p-3 text-sm"
    >
      <div className="mb-1.5">
        <span className="font-semibold text-amber-700">⚠ "{match.original}"</span>
        {match.term.icd10 && (
          <span className="ml-2 text-xs text-gray-400">({match.term.icd10})</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2 leading-snug">{match.term.note}</p>
      <div className="flex flex-col gap-1 mb-2">
        {match.term.preferred.map(p => (
          <button
            key={p}
            onClick={() => onReplace(p)}
            className="text-left text-xs px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 font-medium transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
      <button onClick={onDismiss} aria-label="Skip this suggestion" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        ✕ skip
      </button>
    </div>
  );
};
