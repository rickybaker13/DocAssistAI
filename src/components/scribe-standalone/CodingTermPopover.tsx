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
      aria-modal="true"
      aria-label={`ICD-10 term suggestion for "${match.original}"`}
      style={{
        position: 'fixed',
        left: leftPos,
        top: position.y + 12,
        zIndex: 60,
        width: 300,
        backgroundColor: '#1e293b',
        border: '1px solid #334155',
        color: '#f8fafc',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        borderRadius: '0.75rem',
        padding: '0.75rem',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ marginBottom: '0.375rem' }}>
        <span style={{ fontWeight: 600, color: '#fbbf24' }}>⚠ "{match.original}"</span>
        {match.term.icd10 && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#2dd4bf' }}>({match.term.icd10})</span>
        )}
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem', lineHeight: '1.4' }}>{match.term.note}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
        {match.term.preferred.map(p => (
          <button
            key={p}
            onClick={() => onReplace(p)}
            style={{
              textAlign: 'left',
              fontSize: '0.75rem',
              padding: '0.375rem 0.5rem',
              borderRadius: '0.5rem',
              backgroundColor: '#0f172a',
              color: '#2dd4bf',
              fontWeight: 500,
              border: '1px solid #334155',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#334155')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0f172a')}
            onFocus={e => (e.currentTarget.style.backgroundColor = '#334155')}
            onBlur={e => (e.currentTarget.style.backgroundColor = '#0f172a')}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Skip this suggestion"
        style={{ fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer', background: 'none', border: 'none', padding: 0, transition: 'color 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.color = '#f8fafc')}
        onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
      >
        ✕ skip
      </button>
    </div>
  );
};
