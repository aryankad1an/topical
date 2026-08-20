import { ListTree, PanelLeftClose } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import type { OutlineNode } from '../lib/outline';

interface Props {
  nodes: OutlineNode[];
  activeId: string | null;
  onJump: (node: OutlineNode) => void;
  onClose: () => void;
}

/**
 * Navigator for the document's own headings.
 *
 * A generated lesson plan routinely runs to thirty sections, and scrolling a
 * textarea to find one is the single most tedious thing about writing here.
 */
export function OutlineRail({ nodes, activeId, onJump, onClose }: Props) {
  return (
    <aside className="outline-rail">
      <div className="outline-head">
        <ListTree className="h-3.5 w-3.5" />
        <span>Outline</span>
        <span className="outline-count">{nodes.length}</span>
        <IconButton className="ml-auto" onClick={onClose} title="Hide outline" aria-label="Hide outline">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {nodes.length === 0 ? (
        <p className="outline-empty">
          Headings you add appear here.
          <span>Start a line with <kbd>#</kbd> to make one.</span>
        </p>
      ) : (
        <nav className="outline-list">
          {nodes.map(node => (
            <button
              key={node.id}
              className="outline-item"
              data-level={node.level}
              data-active={node.id === activeId}
              onClick={() => onJump(node)}
              title={node.label}
            >
              <span className="outline-tick" />
              {node.label || <em>Untitled</em>}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
