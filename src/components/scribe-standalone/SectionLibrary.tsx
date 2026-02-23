import React, { useEffect, useState } from 'react';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

interface Template {
  id: string;
  name: string;
  prompt_hint: string | null;
  is_prebuilt: number;
}

const getBackendUrl = () => {
  try { return import.meta.env?.VITE_BACKEND_URL || 'http://localhost:3000'; }
  catch { return 'http://localhost:3000'; }
};

export const SectionLibrary: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const { addSection, canvasSections } = useScribeBuilderStore();

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/templates`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const inCanvas = new Set(canvasSections.map(s => s.templateId));

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..."
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="overflow-y-auto flex-1">
        {filtered.map(t => {
          const added = inCanvas.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => addSection({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 })}
              disabled={added}
              className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-blue-50 transition-colors flex items-center justify-between group ${added ? 'opacity-40 cursor-default' : ''}`}
            >
              <span>{t.name}</span>
              {!added && <span className="text-blue-500 text-xs opacity-0 group-hover:opacity-100">+ Add</span>}
              {added && <span className="text-green-500 text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
