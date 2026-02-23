import { useScribeBuilderStore } from './scribeBuilderStore';

describe('scribeBuilderStore', () => {
  beforeEach(() => {
    useScribeBuilderStore.getState().clearCanvas();
    useScribeBuilderStore.getState().setNoteType('progress_note');
    useScribeBuilderStore.getState().setPatientLabel('');
  });

  it('starts with empty canvas', () => {
    expect(useScribeBuilderStore.getState().canvasSections).toEqual([]);
  });

  it('addSection — adds a section to canvas', () => {
    useScribeBuilderStore.getState().addSection({ id: 'tmpl-1', name: 'HPI', promptHint: null, isPrebuilt: true });
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(1);
    expect(useScribeBuilderStore.getState().canvasSections[0].name).toBe('HPI');
  });

  it('addSection — does not add duplicate sections', () => {
    const s = { id: 'tmpl-1', name: 'HPI', promptHint: null, isPrebuilt: true };
    useScribeBuilderStore.getState().addSection(s);
    useScribeBuilderStore.getState().addSection(s);
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(1);
  });

  it('removeSection — removes section by templateId', () => {
    useScribeBuilderStore.getState().addSection({ id: 'tmpl-1', name: 'HPI', promptHint: null, isPrebuilt: true });
    useScribeBuilderStore.getState().removeSection('tmpl-1');
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(0);
  });

  it('reorderSections — moves section to new position', () => {
    const store = useScribeBuilderStore.getState();
    store.addSection({ id: 'a', name: 'A', promptHint: null, isPrebuilt: true });
    store.addSection({ id: 'b', name: 'B', promptHint: null, isPrebuilt: true });
    store.addSection({ id: 'c', name: 'C', promptHint: null, isPrebuilt: true });
    useScribeBuilderStore.getState().reorderSections('a', 'c');
    const names = useScribeBuilderStore.getState().canvasSections.map(s => s.name);
    expect(names.indexOf('A')).toBeGreaterThan(names.indexOf('C'));
  });

  it('clearCanvas — empties the canvas', () => {
    useScribeBuilderStore.getState().addSection({ id: 't', name: 'X', promptHint: null, isPrebuilt: true });
    useScribeBuilderStore.getState().clearCanvas();
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(0);
  });
});
