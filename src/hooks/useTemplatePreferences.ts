import { useCallback, useMemo, useState } from 'react';

const STORAGE_KEY = 'scribe-template-preferences-v1';
const MAX_FREQUENT_TEMPLATES = 3;

type PreferencesShape = {
  frequentTemplateIds: string[];
  folders: Record<string, string>;
};

function readInitialState(): PreferencesShape {
  if (typeof window === 'undefined') {
    return { frequentTemplateIds: [], folders: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { frequentTemplateIds: [], folders: {} };
    const parsed = JSON.parse(raw) as Partial<PreferencesShape>;
    return {
      frequentTemplateIds: Array.isArray(parsed.frequentTemplateIds) ? parsed.frequentTemplateIds : [],
      folders: parsed.folders && typeof parsed.folders === 'object' ? parsed.folders : {},
    };
  } catch {
    return { frequentTemplateIds: [], folders: {} };
  }
}

export function useTemplatePreferences() {
  const [state, setState] = useState<PreferencesShape>(readInitialState);

  const persist = useCallback((next: PreferencesShape) => {
    setState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const setTemplateFolder = useCallback(
    (templateId: string, folder: string) => {
      const trimmed = folder.trim();
      const nextFolders = { ...state.folders };
      if (!trimmed) {
        delete nextFolders[templateId];
      } else {
        nextFolders[templateId] = trimmed;
      }
      persist({ ...state, folders: nextFolders });
    },
    [persist, state]
  );

  const toggleFrequentTemplate = useCallback(
    (templateId: string) => {
      const hasId = state.frequentTemplateIds.includes(templateId);
      const nextIds = hasId
        ? state.frequentTemplateIds.filter(id => id !== templateId)
        : [...state.frequentTemplateIds, templateId].slice(-MAX_FREQUENT_TEMPLATES);

      persist({ ...state, frequentTemplateIds: nextIds });
    },
    [persist, state]
  );

  const removeTemplateMetadata = useCallback(
    (templateId: string) => {
      persist({
        frequentTemplateIds: state.frequentTemplateIds.filter(id => id !== templateId),
        folders: Object.fromEntries(Object.entries(state.folders).filter(([id]) => id !== templateId)),
      });
    },
    [persist, state]
  );

  const folders = useMemo(() => {
    const unique = new Set<string>();
    Object.values(state.folders).forEach(folder => {
      if (folder.trim()) unique.add(folder.trim());
    });
    return [...unique].sort((a, b) => a.localeCompare(b));
  }, [state.folders]);

  return {
    frequentTemplateIds: state.frequentTemplateIds,
    foldersByTemplateId: state.folders,
    folders,
    maxFrequentTemplates: MAX_FREQUENT_TEMPLATES,
    setTemplateFolder,
    toggleFrequentTemplate,
    removeTemplateMetadata,
  };
}
