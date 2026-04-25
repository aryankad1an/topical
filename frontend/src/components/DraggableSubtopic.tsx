import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { GripVertical, Trash2 } from 'lucide-react';

interface DraggableSubtopicProps {
  subtopic: string;
  parentTopic: string;
  savedTopics: string[];
  isSelected: boolean;
  isReadOnly: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export function DraggableSubtopic({
  subtopic,
  parentTopic,
  savedTopics,
  isSelected,
  isReadOnly,
  onSelect,
  onDelete,
}: DraggableSubtopicProps) {
  // Set up sortable hooks
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtopic });

  // Apply styles for dragging
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between">
      <div className="flex items-center flex-1">
        {!isReadOnly && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 mr-1 text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-3 w-3" />
          </div>
        )}
        <div
          className={`flex-1 text-sm cursor-pointer p-1.5 rounded-md transition-colors ${
            isSelected
              ? 'bg-secondary/50 text-secondary-foreground'
              : savedTopics.includes(subtopic)
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'hover:bg-muted'
          }`}
          onClick={onSelect}
        >
          {subtopic}
        </div>
      </div>
      {!isReadOnly && (
        <div className="flex pr-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
            title="Delete subtopic"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
