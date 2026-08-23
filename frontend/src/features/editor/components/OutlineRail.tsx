import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ListTree, Loader2, PanelLeftClose, Plus, Sparkles, Wand2 } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import type { OutlineNode } from '../lib/outline';
import { fetchHierarchy, outlineDraft, refinePlan, type RefinedPlan } from '../lib/generation';
import { MAX_OUTLINE_WIDTH, MIN_OUTLINE_WIDTH } from '../lib/viewOptions';
import { useDragResize } from '../hooks/useDragResize';
import { useOutlineRows } from '../hooks/useOutlineRows';
import { useSectionWriter } from '../hooks/useSectionWriter';
import { OutlineRow } from './OutlineRow';
import { OutlineProposal } from './OutlineProposal';
import { SectionSource } from './SectionSource';

interface Props {
  format: DocFormat;
  projectName: string;
  /** Current document — outlining a draft reads it. */
  content: string;
  /** Headings actually present in the document right now. */
  documentNodes: OutlineNode[];
  activeLabel: string | null;
  width: number;
  onWidth: (width: number) => void;
  onClose: () => void;
  onJump: (node: OutlineNode) => void;
  onInsertSection: (text: string, title: string, replace: boolean) => void;
  /** Remove a section and everything nested under it from the document. */
  onDeleteSection: (title: string) => void;
  /** Words a delete would take with it, for the warning before it happens. */
  measureSection: (title: string) => number;
  onRenameHeading: (offset: number, next: string) => void;
  onShiftHeading: (offset: number, delta: 1 | -1) => void;
  onMoveHeading: (offset: number, target: number, edge: 'top' | 'bottom') => void;
  /** Returns the offset of the heading it created. */
  onAddHeading: (afterOffset: number | null) => number;
  /** Rewrite the document so its headings match a proposed outline. */
  onApplyOutline: (plan: { title: string; level: number }[]) => void;
}

/**
 * The document's structure, and everything that acts on it.
 *
 * This replaced a read-only navigator sitting next to a separate generation
 * panel. Those were two views of the same thing — the shape of the document —
 * and keeping them apart meant the outline you edited and the outline you
 * navigated could disagree.
 *
 * Composition only. Row gestures live in `useOutlineRows`, generation in
 * `useSectionWriter`, and the two AI panels in their own components; what is
 * left here is the arrangement and the calls that restructure the whole
 * outline at once.
 */
export function OutlineRail({
  format, projectName, content, documentNodes, activeLabel, width, onWidth,
  onClose, onJump, onInsertSection, onDeleteSection, measureSection,
  onRenameHeading, onShiftHeading, onMoveHeading, onAddHeading, onApplyOutline,
}: Props) {
  const [prompt, setPrompt] = useState<'outline' | 'refine' | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [working, setWorking] = useState<'outline' | 'refine' | null>(null);
  const [proposal, setProposal] = useState<RefinedPlan | null>(null);

  // The rail renders the document's headings. There is no second copy of the
  // structure, so there is nothing to keep in step — editing a row edits the
  // page, and typing a heading into the page adds a row.
  const nodes = documentNodes;
  const outline = useMemo(
    () => nodes.map(node => ({ title: node.label, level: node.level })),
    [nodes],
  );

  /** The headings nested directly under a row — what its introduction must avoid. */
  const childrenOf = (node: OutlineNode) => {
    const index = nodes.indexOf(node);
    if (index < 0) return [];
    const depth = node.level + 1;
    const out: string[] = [];
    for (let i = index + 1; i < nodes.length && nodes[i].level > node.level; i += 1) {
      if (nodes[i].level === depth) out.push(nodes[i].label);
    }
    return out;
  };

  const rows = useOutlineRows({
    nodes, childrenOf, measureSection,
    onRenameHeading, onShiftHeading, onMoveHeading, onAddHeading, onDeleteSection,
  });

  const writer = useSectionWriter({
    format, projectName, nodes, outline, childrenOf, onInsertSection,
  });

  const written = nodes.filter(node => measureSection(node.label) > 0).length;

  const startResize = useDragResize({
    from: () => width,
    to: (dx, start) => Math.min(Math.max(start + dx, MIN_OUTLINE_WIDTH), MAX_OUTLINE_WIDTH),
    onChange: onWidth,
  });

  // ── AI over the structure ───────────────────────────────────────────────
  const buildOutlineWith = async (source: 'subject' | 'draft', subject: string) => {
    if (source === 'draft' && !content.trim()) {
      toast.info('Write something first — this reads the page you already have.');
      return;
    }
    if (source === 'subject' && !subject.trim()) return;
    setWorking('outline');
    try {
      const plan = source === 'draft'
        ? await outlineDraft(content, format)
        : await fetchHierarchy(subject);
      // Staged rather than applied. The outline is the document now, so an AI
      // outline rewrites the page — that is not something to do silently.
      setProposal({ summary: `Proposed ${plan.length} sections.`, plan, changes: [] });
      setPrompt(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to build an outline'));
    } finally {
      setWorking(null);
    }
  };

  const runRefine = async (instruction: string) => {
    if (!nodes.length) {
      toast.info('There is no outline to refine yet.');
      return;
    }
    setWorking('refine');
    try {
      const result = await refinePlan(outline, projectName, instruction, format);
      if (!result.changes.length) {
        toast.info(result.summary || 'The model left the structure as it was.');
      }
      setProposal(result);
      setPrompt(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not refine the outline'));
    } finally {
      setWorking(null);
    }
  };

  const applyProposal = () => {
    if (!proposal) return;
    onApplyOutline(proposal.plan);
    rows.closeEdit();
    setProposal(null);
  };

  const openPrompt = (which: 'outline' | 'refine') => {
    setPrompt(current => (current === which ? null : which));
    setPromptValue('');
  };

  const addAtEnd = () => rows.addAfter(nodes[nodes.length - 1] ?? null);

  return (
    <aside className="outline-rail" style={{ width }}>
      <div className="outline-head">
        <ListTree className="h-3.5 w-3.5" />
        <span>Outline</span>
        <span className="outline-count">{written}/{nodes.length}</span>
        <IconButton className="ml-auto" onClick={addAtEnd} title="Add a section" aria-label="Add a section">
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton onClick={onClose} title="Hide outline" aria-label="Hide outline">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="outline-actions">
        <button className="orail-btn" onClick={() => openPrompt('outline')} data-active={prompt === 'outline'}
          disabled={working !== null} title="Build an outline from a subject">
          {working === 'outline' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI outline
        </button>
        <button className="orail-btn" onClick={() => openPrompt('refine')} data-active={prompt === 'refine'}
          disabled={working !== null || !nodes.length} title="Reorganise the structure and explain the changes">
          {working === 'refine' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          Refine
        </button>
      </div>

      {prompt === 'outline' && (
        <form
          className="orail-prompt"
          onSubmit={event => { event.preventDefault(); buildOutlineWith('subject', promptValue); }}
        >
          <input
            className="orail-input" autoFocus placeholder="What is this document about?"
            value={promptValue} onChange={event => setPromptValue(event.target.value)}
          />
          <div className="orail-prompt-row">
            <button type="submit" className="orail-go" disabled={!promptValue.trim() || working !== null}>
              Build outline
            </button>
            <button type="button" className="orail-link" onClick={() => buildOutlineWith('draft', '')}
              disabled={working !== null}>
              From what I've written
            </button>
          </div>
        </form>
      )}

      {prompt === 'refine' && (
        <form
          className="orail-prompt"
          onSubmit={event => { event.preventDefault(); runRefine(promptValue); }}
        >
          <input
            className="orail-input" autoFocus placeholder="Anything specific? (optional)"
            value={promptValue} onChange={event => setPromptValue(event.target.value)}
          />
          <div className="orail-prompt-row">
            <button type="submit" className="orail-go" disabled={working !== null}>
              Refine structure
            </button>
          </div>
        </form>
      )}

      {proposal && (
        <OutlineProposal
          proposal={proposal}
          onApply={applyProposal}
          onDiscard={() => setProposal(null)}
        />
      )}

      <SectionSource
        method={writer.method}
        onMethod={writer.setMethod}
        urls={writer.urls}
        onUrls={writer.setUrls}
        needsUrls={writer.needsUrls}
      />

      {nodes.length === 0 ? (
        <div className="outline-empty">
          <p>No structure yet.</p>
          <p>Add sections by hand, or build one with <b>AI outline</b>.</p>
          <button className="orail-add" onClick={() => rows.addAfter(null)}>
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>
      ) : (
        <div className="outline-list">
          {nodes.map(node => (
            <OutlineRow
              key={node.id}
              item={{ id: node.id, title: node.label, level: node.level }}
              status={writer.status[node.label]}
              inDocument={measureSection(node.label) > 0}
              active={node.label === activeLabel}
              busy={writer.busy || writer.needsUrls}
              editing={rows.editingOffset === node.offset}
              value={rows.editValue}
              onValue={rows.setEditValue}
              onEdit={() => rows.startEdit(node)}
              onCommit={rows.commitEdit}
              onKeyDown={rows.editKeys(node)}
              onPrimary={() => onJump(node)}
              onGenerate={() => writer.writeSection(node)}
              onIndent={() => onShiftHeading(node.offset, 1)}
              onOutdent={() => onShiftHeading(node.offset, -1)}
              onAddAfter={() => rows.addAfter(node)}
              onDelete={() => rows.deleteRow(node)}
              dragging={rows.dragOffset === node.offset}
              dropEdge={rows.dropAt?.offset === node.offset ? rows.dropAt.edge : null}
              onDragStart={rows.rowDragStart(node)}
              onDragOver={rows.rowDragOver(node)}
              onDrop={rows.rowDrop(node)}
              onDragEnd={rows.endDrag}
            />
          ))}
        </div>
      )}

      <div className="outline-foot">
        <button className="orail-add" onClick={addAtEnd} title="Add a section at the end">
          <Plus className="h-3.5 w-3.5" /> Add section
        </button>

        {writer.progress ? (
          <>
            <div className="gen-progress">
              <div className="gen-progress-fill"
                style={{ width: `${(writer.progress.done / writer.progress.total) * 100}%` }} />
            </div>
            <button className="orail-primary" onClick={writer.stop}>
              Stop · {writer.progress.done}/{writer.progress.total}
            </button>
          </>
        ) : (
          <button
            className="orail-primary"
            onClick={writer.writeAll}
            disabled={writer.busy || writer.needsUrls || !nodes.length}
            title={writer.needsUrls ? 'Add a URL first' : 'Write content for every section in the outline'}
          >
            <Sparkles className="h-3 w-3" />
            Generate all sections
          </button>
        )}

        <p className="ai-hint">
          Click a section to jump to it, or to write it if it isn't there yet.
          Double-click to rename, drag to reorder; <kbd>Tab</kbd> / <kbd>⇧Tab</kbd> change depth.
        </p>
      </div>

      <div className="outline-resize" onMouseDown={startResize} role="separator" aria-label="Resize outline" />
    </aside>
  );
}
