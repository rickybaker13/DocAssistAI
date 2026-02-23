import React from 'react';
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
      className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm group"
    >
      <span {...attributes} {...listeners} className="text-gray-400 cursor-grab active:cursor-grabbing text-lg leading-none select-none" title="Drag to reorder">
        ⠿
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{section.name}</p>
        {section.promptHint && <p className="text-xs text-gray-400 truncate">{section.promptHint}</p>}
      </div>
      <button
        onClick={() => removeSection(section.templateId)}
        aria-label="Remove section"
        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0"
      >
        ×
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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-xl min-h-48">
        <p className="text-gray-400 text-sm">Add sections from the library</p>
        <p className="text-gray-300 text-xs mt-1">Tap a section on the left to add it here</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={canvasSections.map(s => s.templateId)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {canvasSections.map(section => (
            <SortableItem key={section.templateId} section={section} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
