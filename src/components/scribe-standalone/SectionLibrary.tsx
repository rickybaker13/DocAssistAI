import React, { useEffect, useState } from 'react';
import { GripVertical, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';
import { getBackendUrl } from '../../config/appConfig';

interface Template {
  id: string;
  name: string;
  prompt_hint: string | null;
  is_prebuilt: number;
  category: string;
  disciplines: string; // JSON array string — parsed client-side
}

const CATEGORY_LABELS: Record<string, string> = {
  general:              'General',
  icu:                  'ICU / Critical Care',
  specialty:            'Specialty',
  body_systems:         'Body Systems',
  physical_therapy:     'Physical Therapy',
  occupational_therapy: 'Occupational Therapy',
  speech_pathology:     'Speech-Language Pathology',
  respiratory_therapy:  'Respiratory Therapy',
  case_management:      'Case Management',
  nutrition:            'Nutrition & Dietetics',
};

// Display order for categories in the "All Sections" grouped view
const CATEGORY_ORDER = [
  'general', 'icu', 'specialty', 'body_systems',
  'physical_therapy', 'occupational_therapy', 'speech_pathology',
  'respiratory_therapy', 'case_management', 'nutrition',
];

type TabKey = 'mine' | 'all';

export const SectionLibrary: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('mine');
  const { addSection, canvasSections } = useScribeBuilderStore();
  const { user } = useScribeAuthStore();
  const navigate = useNavigate();

  // Default to 'all' if user has no discipline set
  useEffect(() => {
    if (!user?.specialty) setActiveTab('all');
    else setActiveTab('mine');
  }, [user?.specialty]);

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
          // silently ignore — empty list shown
        }
      });
    return () => controller.abort();
  }, []);

  const inCanvas = new Set(canvasSections.map(s => s.templateId));
  const query = search.toLowerCase();

  // ── "My Discipline" tab ──────────────────────────────────────────────────
  const myTemplates = templates.filter(t => {
    const disciplines: string[] = JSON.parse(t.disciplines || '[]');
    return user?.specialty ? disciplines.includes(user.specialty) : false;
  });

  const myFiltered = myTemplates.filter(t => t.name.toLowerCase().includes(query));

  // ── "All Sections" tab — grouped by category ──────────────────────────────
  const allFiltered = templates.filter(t => t.name.toLowerCase().includes(query));

  const grouped = CATEGORY_ORDER.reduce<Record<string, Template[]>>((acc, cat) => {
    const items = allFiltered.filter(t => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  // Uncategorized / unknown categories fall through at the end
  const knownCats = new Set(CATEGORY_ORDER);
  const unknownItems = allFiltered.filter(t => !knownCats.has(t.category));
  if (unknownItems.length > 0) grouped['other'] = unknownItems;

  const renderTemplateButton = (t: Template) => {
    const added = inCanvas.has(t.id);
    return (
      <button
        key={t.id}
        onClick={() => addSection({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 || (t.is_prebuilt as unknown) === true })}
        disabled={added}
        className={`group w-full text-left bg-slate-800 border border-slate-700 rounded-lg p-3 transition-all duration-150 flex items-center gap-2 ${
          added ? 'opacity-40 cursor-default' : 'cursor-grab hover:bg-slate-700 hover:border-slate-600'
        }`}
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
  };

  const hasDiscipline = Boolean(user?.specialty);
  const showTabs = hasDiscipline;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Search */}
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

      {/* Tabs — only shown when discipline is set */}
      {showTabs && (
        <div className="flex border-b border-slate-700">
          {(['mine', 'all'] as TabKey[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'mine' ? 'My Discipline' : 'All Sections'}
            </button>
          ))}
        </div>
      )}

      {/* No discipline set — soft banner */}
      {!hasDiscipline && (
        <button
          onClick={() => navigate('/scribe/settings')}
          className="mx-3 mt-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-teal-400 hover:border-teal-900 transition-colors flex items-center gap-2 text-left"
        >
          <Settings size={13} className="flex-shrink-0 text-slate-500" />
          <span>Set your discipline in Settings to see sections for your role</span>
        </button>
      )}

      {/* Section list */}
      <div className="overflow-y-auto flex-1 p-2 flex flex-col gap-1">
        {activeTab === 'mine' && hasDiscipline && (
          myFiltered.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-6">
              {search ? 'No matching sections.' : 'No sections for your discipline yet.'}
            </p>
          ) : (
            myFiltered.map(renderTemplateButton)
          )
        )}

        {activeTab === 'all' && (
          allFiltered.length === 0 ? (
            <p className="text-slate-500 text-xs text-center py-6">No matching sections.</p>
          ) : search ? (
            // Flat list when searching — easier to scan
            allFiltered.map(renderTemplateButton)
          ) : (
            // Grouped by category when not searching
            Object.entries(grouped).map(([cat, items]) => (
              <details key={cat} open className="group/cat">
                <summary className="flex items-center gap-1 cursor-pointer list-none px-1 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider select-none hover:text-slate-300">
                  <span className="flex-1">{CATEGORY_LABELS[cat] ?? cat}</span>
                  <span className="text-slate-600 text-[10px] group-open/cat:hidden">▶</span>
                  <span className="text-slate-600 text-[10px] hidden group-open/cat:inline">▼</span>
                </summary>
                <div className="flex flex-col gap-1 pb-2">
                  {items.map(renderTemplateButton)}
                </div>
              </details>
            ))
          )
        )}
      </div>
    </div>
  );
};
