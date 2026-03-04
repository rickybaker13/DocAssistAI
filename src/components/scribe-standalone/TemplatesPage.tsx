import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus } from 'lucide-react';
import { NoteTemplate, useNoteTemplates } from '../../hooks/useNoteTemplates';
import { useTemplatePreferences } from '../../hooks/useTemplatePreferences';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { buildCanvasSectionsFromTemplate } from '../../utils/noteTemplateUtils';

const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
];

export const TemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const { noteType, setNoteType, setSelectedTemplate, setVerbosity } = useScribeBuilderStore();
  const { userTemplates, loading, deleteTemplate } = useNoteTemplates(noteType);
  const {
    frequentTemplateIds,
    folders,
    foldersByTemplateId,
    maxFrequentTemplates,
    setTemplateFolder,
    toggleFrequentTemplate,
    removeTemplateMetadata,
  } = useTemplatePreferences();

  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const templateOptionsByFolder = useMemo(() => {
    const grouped: Record<string, NoteTemplate[]> = { Unsorted: [] };

    userTemplates.forEach(tmpl => {
      const folder = foldersByTemplateId[tmpl.id]?.trim();
      const key = folder || 'Unsorted';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(tmpl);
    });

    return Object.entries(grouped)
      .map(([name, templates]) => ({
        name,
        templates: templates.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter(group => group.templates.length > 0)
      .sort((a, b) => {
        if (a.name === 'Unsorted') return -1;
        if (b.name === 'Unsorted') return 1;
        return a.name.localeCompare(b.name);
      });
  }, [foldersByTemplateId, userTemplates]);

  const visibleGroups = selectedFolderFilter === 'all'
    ? templateOptionsByFolder
    : templateOptionsByFolder.filter(group => group.name === selectedFolderFilter);

  const handleUseTemplate = (tmpl: NoteTemplate) => {
    setSelectedTemplate(tmpl.id, buildCanvasSectionsFromTemplate(tmpl));
    setVerbosity(tmpl.verbosity);
    navigate('/scribe/note/new');
  };

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    if (folders.some(folder => folder.toLowerCase() === trimmed.toLowerCase())) {
      setError('Folder already exists');
      return;
    }
    setError(null);
    setSelectedFolderFilter(trimmed);
    setNewFolderName('');
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteTemplate(templateId);
    removeTemplateMetadata(templateId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-50">Templates</h1>
        <button onClick={() => navigate('/scribe/note/new')} className="text-sm text-slate-400 hover:text-slate-200">Back to New Note</button>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={noteType}
          onChange={e => setNoteType(e.target.value)}
          aria-label="Template note type"
          className="bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select
          value={selectedFolderFilter}
          onChange={e => setSelectedFolderFilter(e.target.value)}
          aria-label="Filter by folder"
          className="bg-slate-800 border border-slate-700 text-slate-50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value="all">All folders</option>
          <option value="Unsorted">Unsorted</option>
          {folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Create folder"
            className="bg-slate-800 border border-slate-700 text-slate-50 placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            onClick={handleCreateFolder}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 text-sm hover:border-slate-500 inline-flex items-center gap-1"
          >
            <FolderPlus size={14} aria-hidden="true" />
            Add Folder
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-400">Choose up to {maxFrequentTemplates} frequent templates for quick access on New Note.</p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {loading && <p className="text-sm text-slate-400">Loading templates...</p>}

      {!loading && userTemplates.length === 0 && (
        <p className="text-sm text-slate-400">No saved templates yet. Create one from the New Note page.</p>
      )}

      <div className="flex flex-col gap-4">
        {visibleGroups.map(group => (
          <div key={group.name} className="border border-slate-800 rounded-xl p-3 bg-slate-900/70">
            <h2 className="text-sm font-semibold text-slate-200 mb-3">{group.name}</h2>
            <div className="flex flex-col gap-2">
              {group.templates.map(tmpl => {
                const isFrequent = frequentTemplateIds.includes(tmpl.id);
                return (
                  <div key={tmpl.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex flex-wrap gap-2 items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{tmpl.name}</p>
                      <p className="text-xs text-slate-400">Verbosity: {tmpl.verbosity}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <select
                        value={foldersByTemplateId[tmpl.id] || ''}
                        onChange={e => setTemplateFolder(tmpl.id, e.target.value)}
                        aria-label={`Folder for ${tmpl.name}`}
                        className="bg-slate-900 border border-slate-600 text-slate-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="">Unsorted</option>
                        {folders.map(folder => <option key={folder} value={folder}>{folder}</option>)}
                      </select>
                      <button
                        onClick={() => toggleFrequentTemplate(tmpl.id)}
                        className={`text-xs px-2 py-1 rounded border ${isFrequent ? 'border-teal-400 text-teal-300 bg-teal-950/40' : 'border-slate-600 text-slate-300 hover:border-slate-500'}`}
                      >
                        {isFrequent ? 'Frequent ✓' : 'Set frequent'}
                      </button>
                      <button onClick={() => handleUseTemplate(tmpl)} className="text-xs px-2 py-1 rounded bg-teal-400 text-slate-950 font-semibold hover:bg-teal-300">Use in New Note</button>
                      <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-xs px-2 py-1 rounded border border-red-900 text-red-300 hover:bg-red-950/40">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
