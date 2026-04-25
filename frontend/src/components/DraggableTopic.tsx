import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Topic } from '@/routes/_authenticated/lesson-plan';
import { Button } from './ui/button';
import { GripVertical, PlusCircle, Trash2 } from 'lucide-react';
import { DraggableSubtopicList } from './DraggableSubtopicList';

interface DraggableTopicProps {
  topic: Topic;
  savedTopics: string[];
  isSelected: boolean;
  selectedSubtopic?: string | null;
  isReadOnly: boolean;
  onSelect: () => void;
  onSubtopicSelect?: (subtopic: string, parentTopic: string) => void;
  onAddSubtopic: () => void;
  onDelete: () => void;
  onSubtopicsReordered?: (parentTopic: string, reorderedSubtopics: string[]) => void;
}

export function DraggableTopic({
  topic,
  savedTopics,
  isSelected,
  selectedSubtopic = null,
  isReadOnly,
  onSelect,
  onSubtopicSelect,
  onAddSubtopic,
  onDelete,
  onSubtopicsReordered,
}: DraggableTopicProps) {
  // Set up sortable hooks
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.topic });

  // Apply styles for dragging
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  // Handle subtopics reordering
  const handleSubtopicsReordered = (reorderedSubtopics: string[]) => {
    if (onSubtopicsReordered) {
      onSubtopicsReordered(topic.topic, reorderedSubtopics);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          {!isReadOnly && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 mr-1 text-muted-foreground hover:text-foreground"
            >
              <GripVertical className="h-4 w-4" />
            </div>
          )}
          <div
            className={`flex-1 font-medium cursor-pointer p-2 rounded-md transition-colors ${
              isSelected
                ? 'bg-primary/10 text-primary'
                : savedTopics.includes(topic.topic)
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  : 'hover:bg-muted'
            }`}
            onClick={onSelect}
          >
            {topic.topic}
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex space-x-1 pr-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAddSubtopic();
              }}
              className="h-6 w-6 p-0 hover:bg-muted"
              title="Add subtopic"
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
              title="Delete topic"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Render subtopics if any */}
      {topic.subtopics && topic.subtopics.length > 0 && (
        <div className="pl-4 mt-1">
          <DraggableSubtopicList
            parentTopic={topic.topic}
            subtopics={topic.subtopics}
            savedTopics={savedTopics}
            selectedSubtopic={selectedSubtopic}
            isReadOnly={isReadOnly}
            onSubtopicSelect={onSubtopicSelect}
            onDeleteSubtopic={(subtopic, isSubtopic, parentTopic) => {
              if (onSubtopicsReordered) {
                // Update the subtopics list after deletion
                const updatedSubtopics = topic.subtopics.filter(st => st !== subtopic);
                onSubtopicsReordered(topic.topic, updatedSubtopics);
              }
            }}
            onSubtopicsReordered={handleSubtopicsReordered}
          />
        </div>
      )}
    </div>
  );
}
