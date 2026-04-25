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
import { DraggableTopic } from './DraggableTopic';
import { Topic } from '@/routes/_authenticated/lesson-plan';
import { Button } from './ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface DraggableTopicListProps {
  topics: Topic[];
  savedTopics: string[];
  selectedTopic: string | null;
  selectedSubtopic?: string | null;
  isReadOnly: boolean;
  onTopicSelect: (topic: string) => void;
  onSubtopicSelect?: (subtopic: string, parentTopic: string) => void;
  onAddSubtopic: (parentTopic: string) => void;
  onDeleteTopic: (topic: string, isSubtopic: boolean, parentTopic?: string) => void;
  onTopicsReordered: (reorderedTopics: Topic[]) => void;
}

export function DraggableTopicList({
  topics,
  savedTopics,
  selectedTopic,
  selectedSubtopic = null,
  isReadOnly,
  onTopicSelect,
  onSubtopicSelect,
  onAddSubtopic,
  onDeleteTopic,
  onTopicsReordered,
}: DraggableTopicListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Find the active topic
  const activeTopic = activeId ? topics.find(topic => topic.topic === activeId) : null;

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
      const oldIndex = topics.findIndex(topic => topic.topic === active.id);
      const newIndex = topics.findIndex(topic => topic.topic === over.id);

      // Reorder the topics
      const reorderedTopics = arrayMove(topics, oldIndex, newIndex);

      console.log('Topics reordered:', reorderedTopics);

      // Call the callback to update the parent state
      onTopicsReordered(reorderedTopics);
    }

    setActiveId(null);
  };

  // Handle subtopics reordering
  const handleSubtopicsReordered = (parentTopic: string, reorderedSubtopics: string[]) => {
    console.log('Subtopics reordered for parent:', parentTopic, reorderedSubtopics);

    // Find the parent topic in the topics array
    const updatedTopics = [...topics];
    const parentTopicIndex = updatedTopics.findIndex(t => t.topic === parentTopic);

    if (parentTopicIndex === -1) {
      console.error('Parent topic not found:', parentTopic);
      return;
    }

    // Update the subtopics array for the parent topic
    updatedTopics[parentTopicIndex] = {
      ...updatedTopics[parentTopicIndex],
      subtopics: reorderedSubtopics
    };

    // Call the callback to update the parent state
    onTopicsReordered(updatedTopics);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={topics.map(topic => topic.topic)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1 mb-3">
          {topics.map((topic) => (
            <DraggableTopic
              key={topic.topic}
              topic={topic}
              savedTopics={savedTopics}
              isSelected={selectedTopic === topic.topic}
              selectedSubtopic={selectedSubtopic}
              isReadOnly={isReadOnly}
              onSelect={() => onTopicSelect(topic.topic)}
              onSubtopicSelect={onSubtopicSelect}
              onAddSubtopic={() => onAddSubtopic(topic.topic)}
              onDelete={() => onDeleteTopic(topic.topic, false)}
              onSubtopicsReordered={handleSubtopicsReordered}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drag overlay for visual feedback */}
      <DragOverlay>
        {activeId && activeTopic ? (
          <div className="font-medium p-2 rounded-md bg-primary/20 text-primary border border-primary/30 shadow-md">
            {activeTopic.topic}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
