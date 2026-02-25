import React, { useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useCodingHighlights, Match } from '../../hooks/useCodingHighlights';
import { CodingTermPopover } from './CodingTermPopover';

interface Section {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

interface Props {
  section: Section;
  onChange: (id: string, content: string) => void;
  onFocusedAI: (section: Section) => void;
  onDelete?: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const color =
    confidence >= 0.8
      ? 'bg-teal-950 text-teal-400 border border-teal-400/30'
      : confidence >= 0.5
      ? 'bg-amber-950 text-amber-400 border border-amber-400/30'
      : 'bg-red-950 text-red-400 border border-red-400/30';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{pct}%</span>;
}

/** Build overlay nodes: all text color:transparent, flagged spans get amber bottom border. */
function buildOverlayNodes(text: string, matches: Match[]): React.ReactNode {
  if (!matches.length) return <span style={{ color: 'transparent' }}>{text}</span>;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      nodes.push(<span key={`t${cursor}`} style={{ color: 'transparent' }}>{text.slice(cursor, match.start)}</span>);
    }
    nodes.push(
      <mark key={`m${match.start}`} style={{ color: 'transparent', background: 'transparent', borderBottom: '2px solid #fbbf24', padding: 0 }}>
        {text.slice(match.start, match.end)}
      </mark>
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    nodes.push(<span key={`t${cursor}`} style={{ color: 'transparent' }}>{text.slice(cursor)}</span>);
  }
  return <>{nodes}</>;
}

export const NoteSectionEditor: React.FC<Props> = ({ section, onChange, onFocusedAI, onDelete }) => {
  const text = section.content || '';
  const matches = useCodingHighlights(text);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(section.id, e.target.value);
    setActiveMatch(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const pos = e.currentTarget.selectionStart;
    const hit = matches.find(m => pos >= m.start && pos <= m.end);
    if (hit) {
      setActiveMatch(hit);
      setPopoverPos({ x: e.clientX, y: e.clientY });
    } else {
      setActiveMatch(null);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const handleReplace = (preferred: string) => {
    if (!activeMatch) return;
    const newText = text.slice(0, activeMatch.start) + preferred + text.slice(activeMatch.end);
    onChange(section.id, newText);
    setActiveMatch(null);
    setPopoverPos(null);
  };

  const handleDismiss = () => { setActiveMatch(null); setPopoverPos(null); };

  const copySection = () => navigator.clipboard.writeText(text);

  // Both overlay and textarea must share identical layout styles
  const sharedStyle: React.CSSProperties = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    padding: '0.5rem 0.75rem',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  };

  const rows = Math.max(3, Math.ceil((text.length || 1) / 80));

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-xl overflow-hidden mb-3 ${
      section.confidence === null
        ? 'border-l-4 border-l-slate-600'
        : section.confidence > 0.8
        ? 'border-l-4 border-l-teal-400'
        : section.confidence >= 0.5
        ? 'border-l-4 border-l-amber-400'
        : 'border-l-4 border-l-red-400'
    }`}>
      {/* Section header row */}
      <div className="bg-slate-800 px-4 pt-3 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{section.section_name.toUpperCase()}</span>
          <ConfidenceBadge confidence={section.confidence} />
          {matches.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-400/30 font-medium"
              title={`${matches.length} ICD-10 coding term${matches.length !== 1 ? 's' : ''} to review`}
            >
              <span aria-hidden="true">⚠ {matches.length}</span>
              <span className="sr-only">{matches.length} ICD-10 coding term{matches.length !== 1 ? 's' : ''} to review</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFocusedAI(section)}
            aria-label="Focused AI"
            className="flex items-center gap-1 text-xs text-teal-400 hover:bg-teal-400/10 px-2 py-1 rounded transition-colors"
          >
            <Sparkles size={14} aria-hidden="true" />
            Focused AI
          </button>
          <button onClick={copySection} aria-label="Copy section" className="text-xs text-slate-400 hover:text-slate-200 px-1" title="Copy section">⎘</button>
          {onDelete && (
            <button onClick={onDelete} aria-label={`Delete ${section.section_name} section`}
              className="text-xs text-slate-600 hover:text-red-400 px-1 transition-colors" title="Remove section">×</button>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Highlight overlay — behind the textarea */}
        <div
          ref={overlayRef}
          data-testid="coding-highlight-overlay"
          aria-hidden="true"
          style={{ ...sharedStyle, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}
        >
          {buildOverlayNodes(text, matches)}
          {'\n'}
        </div>

        {/* Transparent textarea on top */}
        <textarea
          value={text}
          onChange={handleChange}
          onClick={handleClick}
          onScroll={handleScroll}
          aria-label={section.section_name}
          style={{ ...sharedStyle, background: 'transparent', position: 'relative', color: '#f1f5f9' }}
          className="w-full focus:outline-none resize-none min-h-[80px] placeholder:text-slate-500"
          rows={rows}
        />
      </div>

      {activeMatch && popoverPos && (
        <CodingTermPopover match={activeMatch} position={popoverPos} onReplace={handleReplace} onDismiss={handleDismiss} />
      )}
    </div>
  );
};
