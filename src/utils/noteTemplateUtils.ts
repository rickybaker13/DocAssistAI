import { NoteTemplate } from '../hooks/useNoteTemplates';
import { CanvasSection } from '../stores/scribeBuilderStore';

export function buildCanvasSectionsFromTemplate(tmpl: NoteTemplate): CanvasSection[] {
  return (JSON.parse(tmpl.sections) as Array<{ name: string; promptHint: string | null }>).map((s, i) => ({
    canvasId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
    templateId: `tmpl-${tmpl.id}-${i}`,
    name: s.name,
    promptHint: s.promptHint,
    isPrebuilt: tmpl.user_id === null,
  }));
}

