import {
  AlertTriangle, Check, ChevronLeft, ChevronRight, GripVertical, Pencil, Plus,
  Sparkles, Trash2, Loader2,
} from 'lucide-react';
import type { PlanItem } from '../lib/plan';

export type RowStatus = 'generating' | 'failed';

interface RowProps {
  item: PlanItem;
  status?: RowStatus;
  inDocument: boolean;
  active: boolean;
  busy: boolean;
  editing: boolean;
  value: string;
  onValue: (next: string) => void;
  onEdit: () => void;
  onCommit: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPrimary: () => void;
  onGenerate: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onAddAfter: () => void;
  onDelete: () => void;
  dragging: boolean;
  dropEdge: 'top' | 'bottom' | null;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}

/**
 * One outline row: its depth, whether it has reached the page yet, and the
 * handles for reshaping it.
 *
 * Clicking the name does the obvious thing for the state it is in — a section
 * already in the document scrolls to it, one that isn't gets written. The ✨
 * always writes, which is how a finished section gets rewritten.
 */
export function OutlineRow({
  item, status, inDocument, active, busy, editing, value, onValue, onEdit, onCommit,
  onKeyDown, onPrimary, onGenerate, onIndent, onOutdent, onAddAfter, onDelete,
  dragging, dropEdge, onDragStart, onDragOver, onDrop, onDragEnd,
}: RowProps) {
  const empty = !item.title.trim();
  const title = empty
    ? 'Name this section'
    : inDocument
      ? `Go to "${item.title}"`
      : `Write "${item.title}" into the document`;

  return (
    <div
      className="orow"
      data-status={status ?? 'idle'}
      data-active={active}
      data-in-doc={inDocument}
      data-dragging={dragging}
      data-drop={dropEdge ?? undefined}
      // Editing puts a text input in the row; a draggable ancestor stops the
      // caret from being placed by mouse, so dragging is off while renaming.
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: 4 + (item.level - 1) * 14 }}
    >
      <span className="orow-grip" aria-hidden title="Drag to reorder">
        <GripVertical className="h-3 w-3" />
      </span>

      <span className="orow-mark" aria-hidden>
        {status === 'generating' ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
          : status === 'failed' ? <AlertTriangle className="h-2.5 w-2.5" />
            : inDocument ? <Check className="h-2.5 w-2.5" /> : null}
      </span>

      {editing ? (
        <input
          className="orow-input"
          autoFocus
          value={value}
          placeholder="Section title"
          onChange={event => onValue(event.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
        />
      ) : (
        <button
          className="orow-name"
          data-empty={empty}
          disabled={busy || empty}
          onClick={onPrimary}
          onDoubleClick={onEdit}
          title={title}
        >
          {item.title || 'Untitled section'}
        </button>
      )}

      <span className="orow-tools">
        <button className="orow-tool orow-tool--go" onClick={onGenerate} disabled={busy || empty}
          title={inDocument ? 'Write this section again' : 'Write this section'} aria-label="Write this section">
          <Sparkles className="h-3 w-3" />
        </button>
        <button className="orow-tool" onClick={onOutdent} disabled={item.level <= 1} title="Outdent" aria-label="Outdent">
          <ChevronLeft className="h-3 w-3" />
        </button>
        <button className="orow-tool" onClick={onIndent} title="Indent" aria-label="Indent">
          <ChevronRight className="h-3 w-3" />
        </button>
        <button className="orow-tool orow-tool--add" onClick={onAddAfter} title="Add a section below" aria-label="Add a section below">
          <Plus className="h-3 w-3" />
        </button>
        <button className="orow-tool" onClick={onEdit} title="Rename" aria-label="Rename">
          <Pencil className="h-3 w-3" />
        </button>
        <button className="orow-tool orow-tool--danger" onClick={onDelete} title="Delete" aria-label="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}
