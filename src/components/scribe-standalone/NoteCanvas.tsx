import React from 'react';
import { GripVertical, X } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useScribeBuilderStore, CanvasSection } from '../../stores/scribeBuilderStore';

const SortableItem: React.FC<{ section: CanvasSection }> = ({ section }) => {
  const { removeSection } = useScribeBuilderStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.templateId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="bg-slate-800 border border-slate-700 border-l-4 border-l-teal-400 rounded-lg p-3 flex items-center gap-2"
    >
      <span {...attributes} {...listeners} className="text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing flex-shrink-0" title="Drag to reorder">
        <GripVertical size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 text-sm truncate">{section.name}</p>
        {section.promptHint && <p className="text-xs text-slate-500 truncate">{section.promptHint}</p>}
      </div>
      <button
        type="button"
        onClick={() => removeSection(section.templateId)}
        aria-label="Remove section"
        className="text-slate-600 hover:text-red-400 p-1 rounded transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const NoteCanvas: React.FC = () => {
  const { canvasSections, reorderSections } = useScribeBuilderStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderSections(String(active.id), String(over.id));
    }
  };

  if (canvasSections.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-dashed border-2 border-slate-700 text-slate-600 rounded-xl min-h-48">
        <p className="text-sm">Add sections from the library</p>
        <p className="text-xs mt-1 text-slate-600">Tap a section on the left to add it here</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={canvasSections.map(s => s.templateId)} strategy={verticalListSortingStrategy}>
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 flex flex-col gap-2">
          {canvasSections.map(section => (
            <SortableItem key={section.templateId} section={section} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
