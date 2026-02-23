import React, { useState } from 'react';

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
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.8 ? 'bg-green-100 text-green-700' : confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{pct}%</span>;
}

export const NoteSectionEditor: React.FC<Props> = ({ section, onChange, onFocusedAI }) => {
  const [content, setContent] = useState(section.content || '');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onChange(section.id, e.target.value);
  };

  const copySection = () => navigator.clipboard.writeText(content);

  return (
    <div className={`border rounded-xl overflow-hidden ${section.confidence !== null && section.confidence < 0.5 ? 'border-yellow-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{section.section_name}</span>
          <ConfidenceBadge confidence={section.confidence} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFocusedAI(section)}
            aria-label="Focused AI"
            className="text-xs text-purple-600 border border-purple-200 rounded px-2 py-0.5 hover:bg-purple-50 transition-colors"
          >
            ⚡ Focused AI
          </button>
          <button onClick={copySection} className="text-xs text-gray-400 hover:text-gray-600 px-1" title="Copy section">
            ⎘
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={handleChange}
        className="w-full px-3 py-2 text-sm font-mono focus:outline-none resize-none min-h-[80px]"
        rows={Math.max(3, Math.ceil((content.length || 1) / 80))}
      />
    </div>
  );
};
