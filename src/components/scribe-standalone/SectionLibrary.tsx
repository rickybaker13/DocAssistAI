import React, { useEffect, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { getBackendUrl } from '../../config/appConfig';

interface Template {
  id: string;
  name: string;
  prompt_hint: string | null;
  is_prebuilt: number;
}

export const SectionLibrary: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const { addSection, canvasSections } = useScribeBuilderStore();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getBackendUrl()}/api/scribe/templates`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setTemplates(d.templates || []))
      .catch(err => {
        if (err.name !== 'AbortError') {
          // silently ignore non-abort errors (empty list shown)
        }
      });
    return () => controller.abort();
  }, []);

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const inCanvas = new Set(canvasSections.map(s => s.templateId));

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="px-3 py-2 border-b border-slate-700">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..."
          aria-label="Search sections"
          className="w-full bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>
      <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1">
        {filtered.map(t => {
          const added = inCanvas.has(t.id);
          return (
            <button
              key={t.id}
              onClick={() => addSection({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 })}
              disabled={added}
              className={`group w-full text-left bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all duration-150 flex items-center gap-2 ${added ? 'opacity-40 cursor-default' : 'cursor-grab hover:bg-slate-700 hover:border-slate-600'}`}
            >
              <GripVertical size={14} className="text-slate-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-sm font-medium truncate">{t.name}</p>
                {t.prompt_hint && <p className="text-slate-500 text-xs truncate">{t.prompt_hint}</p>}
              </div>
              {!added && <span className="text-teal-400 text-xs opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">+ Add</span>}
              {added && <span className="text-teal-400 text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
