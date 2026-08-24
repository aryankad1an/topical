import {
  AlertTriangle, ChevronLeft, ChevronRight, GripVertical, Loader2, Pencil, Plus,
  Sparkles, Trash2,
} from 'lucide-react';
import type { PlanItem } from '../lib/plan';

export type RowStatus = 'generating' | 'failed';

interface RowProps {
  item: PlanItem;
  status?: RowStatus;
  /** Words written under this heading. Zero means the section is still a promise. */
  words: number;
  active: boolean;
  /** A generation run is in flight — every row's write button waits for it. */
  busy: boolean;
  /** False when the chosen source is not configured yet (URLs, with none given). */
  canGenerate: boolean;
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

/** Compact enough to sit in a 40px column and still be read at a glance. */
function shortCount(words: number): string {
  return words >= 1000 ? `${(words / 1000).toFixed(1)}k` : String(words);
}

/**
 * One outline row: its depth, how much of it is written, and the handles for
 * reshaping it.
 *
 * The written/unwritten signal used to be a green tick in a circle on every
 * row that had prose behind it — a checklist over a document nobody was
 * ticking off, and by the end of a draft it was a column of identical marks
 * carrying no information. What the writer actually wants to know is *how
 * much* is there, so the same slot now holds the section's word count, and
 * only a run in progress or a failure puts a symbol in it.
 */
export function OutlineRow({
  item, status, words, active, busy, canGenerate, editing, value, onValue, onEdit, onCommit,
  onKeyDown, onPrimary, onGenerate, onIndent, onOutdent, onAddAfter, onDelete,
  dragging, dropEdge, onDragStart, onDragOver, onDrop, onDragEnd,
}: RowProps) {
  const empty = !item.title.trim();
  const written = words > 0;
  const title = empty
    ? 'Name this section'
    : written
      ? `Go to "${item.title}" — ${words} words`
      : `Write "${item.title}" into the document`;

  // One rule per ancestor, so the tree lines run the full height of a subtree
  // instead of appearing and stopping on individual rows.
  const ancestors = Array.from({ length: Math.max(0, item.level - 1) }, (_, i) => i + 1);

  return (
    <div
      className="orow"
      role="listitem"
      data-status={status ?? 'idle'}
      data-active={active}
      data-written={written}
      data-dragging={dragging}
      data-drop={dropEdge ?? undefined}
      // Editing puts a text input in the row; a draggable ancestor stops the
      // caret from being placed by mouse, so dragging is off while renaming.
      draggable={!editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      // Depth travels to CSS as a number, not just as padding: the guides and
      // the per-level type scale both need to know it, and three places
      // computing `(level - 1) * 14` independently is how they end up
      // disagreeing by a pixel.
      style={{ ['--orow-level' as string]: item.level }}
      data-level={Math.min(item.level, 4)}
    >
      {/* Real elements, not a background image on the row. A background is
          clipped to the row that paints it, which is why the old guides read
          as a stack of disconnected dashes rather than as a tree: each row
          drew its own short segment at its own parent's indent and nothing
          joined them up. These are full-height, one per ancestor, and rows
          are flush, so they meet. */}
      {ancestors.map(depth => (
        <i
          key={depth}
          className="orow-guide"
          aria-hidden="true"
          style={{ ['--orow-guide' as string]: depth }}
        />
      ))}

      <span className="orow-grip" aria-hidden title="Drag to reorder">
        <GripVertical className="h-3 w-3" />
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
          // Navigating is not generating. This used to be disabled whenever the
          // source needed configuring, so choosing "URLs" made the whole
          // outline unclickable until a URL was typed — including the rows the
          // writer only wanted to jump to.
          disabled={empty}
          onClick={onPrimary}
          onDoubleClick={onEdit}
          title={title}
        >
          {item.title || 'Untitled section'}
        </button>
      )}

      {/* The one piece of per-row status. Idle sections show what they weigh;
          a section being written or one that failed takes the slot over,
          because those are the only two states that need chasing. */}
      {!editing && (
        <span className="orow-meta" data-kind={status ?? (written ? 'words' : 'todo')}>
          {status === 'generating' ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin" aria-label="Writing" />
          ) : status === 'failed' ? (
            <AlertTriangle className="h-2.5 w-2.5" aria-label="Failed — click ✨ to retry" />
          ) : written ? (
            <span className="orow-words" title={`${words} words`}>{shortCount(words)}</span>
          ) : null}
        </span>
      )}

      <span className="orow-tools">
        <button className="orow-tool orow-tool--go" onClick={onGenerate} disabled={busy || empty || !canGenerate}
          title={written ? 'Write this section again' : 'Write this section'} aria-label="Write this section">
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
