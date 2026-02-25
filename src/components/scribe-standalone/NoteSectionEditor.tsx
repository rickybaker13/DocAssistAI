import React, { useRef, useState } from 'react';
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
  const color = confidence >= 0.8 ? 'bg-green-100 text-green-700' : confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
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
      <mark key={`m${match.start}`} style={{ color: 'transparent', background: 'transparent', borderBottom: '2px solid #f59e0b', padding: 0 }}>
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
    <div className={`border rounded-xl overflow-hidden ${section.confidence !== null && section.confidence < 0.5 ? 'border-yellow-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{section.section_name.toUpperCase()}</span>
          <ConfidenceBadge confidence={section.confidence} />
          {matches.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium"
              title={`${matches.length} ICD-10 coding term${matches.length > 1 ? 's' : ''} to review`}
            >
              ⚠ {matches.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onFocusedAI(section)} aria-label="Focused AI"
            className="text-xs text-purple-600 border border-purple-200 rounded px-2 py-0.5 hover:bg-purple-50 transition-colors">
            ⚡ Focused AI
          </button>
          <button onClick={copySection} aria-label="Copy section" className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Copy section">⎘</button>
          {onDelete && (
            <button onClick={onDelete} aria-label={`Delete ${section.section_name} section`}
              className="text-xs text-gray-300 hover:text-red-400 px-1 transition-colors" title="Remove section">×</button>
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
          style={{ ...sharedStyle, background: 'transparent', position: 'relative' }}
          className="w-full focus:outline-none resize-none min-h-[80px]"
          rows={rows}
        />
      </div>

      {activeMatch && popoverPos && (
        <CodingTermPopover match={activeMatch} position={popoverPos} onReplace={handleReplace} onDismiss={handleDismiss} />
      )}
    </div>
  );
};
