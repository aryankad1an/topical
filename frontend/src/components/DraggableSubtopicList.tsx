import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableSubtopic } from './DraggableSubtopic';

interface DraggableSubtopicListProps {
  parentTopic: string;
  subtopics: string[];
  savedTopics: string[];
  selectedSubtopic: string | null;
  isReadOnly: boolean;
  onSubtopicSelect: (subtopic: string, parentTopic: string) => void;
  onDeleteSubtopic: (subtopic: string, isSubtopic: boolean, parentTopic: string) => void;
  onSubtopicsReordered: (reorderedSubtopics: string[]) => void;
}

export function DraggableSubtopicList({
  parentTopic,
  subtopics,
  savedTopics,
  selectedSubtopic,
  isReadOnly,
  onSubtopicSelect,
  onDeleteSubtopic,
  onSubtopicsReordered,
}: DraggableSubtopicListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Set up sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum distance required before activating
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find the indices of the items
      const oldIndex = subtopics.findIndex(subtopic => subtopic === active.id);
      const newIndex = subtopics.findIndex(subtopic => subtopic === over.id);

      // Reorder the subtopics
      const reorderedSubtopics = arrayMove(subtopics, oldIndex, newIndex);

      console.log('Subtopics reordered in DraggableSubtopicList:', reorderedSubtopics);
      console.log('Parent topic:', parentTopic);

      // Call the callback to update the parent state
      onSubtopicsReordered(reorderedSubtopics);
    }

    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={subtopics}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {subtopics.map((subtopic) => (
            <DraggableSubtopic
              key={subtopic}
              subtopic={subtopic}
              parentTopic={parentTopic}
              savedTopics={savedTopics}
              isSelected={selectedSubtopic === subtopic}
              isReadOnly={isReadOnly}
              onSelect={() => onSubtopicSelect(subtopic, parentTopic)}
              onDelete={() => onDeleteSubtopic(subtopic, true, parentTopic)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeId ? (
          <div className="text-sm p-1.5 rounded-md bg-secondary/30 text-secondary-foreground border border-secondary/30 shadow-md">
            {activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
