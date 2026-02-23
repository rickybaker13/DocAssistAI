import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../config/appConfig';

export interface NoteTemplate {
  id: string;
  user_id: string | null;
  note_type: string;
  name: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  sections: string; // JSON string: Array<{name, promptHint}>
  created_at: string;
}

export interface ParsedSection {
  name: string;
  promptHint: string | null;
}

export function useNoteTemplates(noteType: string) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback((): Promise<void> => {
    if (!noteType) return Promise.resolve();
    setLoading(true);
    setError(null);
    return fetch(`${getBackendUrl()}/api/scribe/note-templates?noteType=${encodeURIComponent(noteType)}`, {
      credentials: 'include',
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setTemplates(d.templates || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, [noteType]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = useCallback(
    async (name: string, verbosity: string, sections: ParsedSection[]) => {
      const res = await fetch(`${getBackendUrl()}/api/scribe/note-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteType, name, verbosity, sections }),
      });
      if (!res.ok) throw new Error('Failed to save template');
      await fetchTemplates();
    },
    [noteType, fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/scribe/note-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      await fetchTemplates();
    },
    [fetchTemplates]
  );

  const systemTemplates = templates.filter(t => t.user_id === null);
  const userTemplates = templates.filter(t => t.user_id !== null);

  return { templates, systemTemplates, userTemplates, loading, error, saveTemplate, deleteTemplate };
}
