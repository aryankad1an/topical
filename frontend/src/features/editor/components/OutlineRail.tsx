import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ListTree, Loader2, PanelLeftClose, Plus, Sparkles } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import type { OutlineNode } from '../lib/outline';
import { ancestorDepths, childTitles, indexOutline, sectionWords } from '../lib/tree';
import { fetchHierarchy, outlineDraft, refinePlan, type RefinedPlan } from '../lib/generation';
import { MAX_OUTLINE_WIDTH, MIN_OUTLINE_WIDTH } from '../lib/viewOptions';
import { useDragResize } from '../hooks/useDragResize';
import { useOutlineRows } from '../hooks/useOutlineRows';
import { useSectionWriter } from '../hooks/useSectionWriter';
import { OutlineRow } from './OutlineRow';
import { OutlineProposal } from './OutlineProposal';
import { WritePopover, type WriteRequest } from './WritePopover';

/**
 * Openers for the instruction box, once there is a structure to change.
 *
 * The chip is a short label; the text it writes is the whole instruction. As
 * full sentences they were each about as wide as the rail, so four of them
 * wrapped to four rows and the openers took more room than the box they were
 * opening. `caret: 'end'` marks the ones that are a prefix to be finished
 * rather than a complete instruction — those focus the field so the sentence
 * can be continued straight away.
 */
const SUGGESTIONS: { label: string; text: string; unfinished?: boolean }[] = [
  { label: 'Add a section', text: 'Add a section on ', unfinished: true },
  { label: 'Reorder', text: 'Reorder so it builds logically' },
  { label: 'Split', text: 'Split anything covering two ideas' },
  { label: 'Trim', text: 'Trim it to the essentials' },
  { label: 'Go deeper', text: 'Break the long sections into sub-sections' },
];

interface Props {
  format: DocFormat;
  projectName: string;
  /** Current document — outlining a draft reads it. */
  content: string;
  /** Headings actually present in the document right now. */
  documentNodes: OutlineNode[];
  /** Id of the heading the caret is inside — not its title. See below. */
  activeId: string | null;
  /**
   * Whether the rail is a drawer over the document rather than a column beside
   * it. Set below ~900px, where a 300px column would leave the writing surface
   * narrower than the text in it.
   */
  compact?: boolean;
  width: number;
  onWidth: (width: number) => void;
  onClose: () => void;
  onJump: (node: OutlineNode) => void;
  /** Show, in the document itself, the section a rail gesture is acting on. */
  onFocusSection: (node: OutlineNode | null) => void;
  onInsertSection: (text: string, title: string, replace: boolean) => void;
  /** Remove a section and everything nested under it from the document. */
  onDeleteSection: (title: string) => void;
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
 * `useSectionWriter`, the hierarchy relations in `lib/tree`, and the proposal
 * in its own component; what is left here is the arrangement and the calls
 * that restructure the whole outline at once.
 */
export function OutlineRail({
  format, projectName, content, documentNodes, activeId, compact, width, onWidth,
  onClose, onJump, onFocusSection, onInsertSection, onDeleteSection,
  onRenameHeading, onShiftHeading, onMoveHeading, onAddHeading, onApplyOutline,
}: Props) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptValue, setPromptValue] = useState('');
  const [working, setWorking] = useState(false);
  const [proposal, setProposal] = useState<RefinedPlan | null>(null);

  // The rail renders the document's headings. There is no second copy of the
  // structure, so there is nothing to keep in step — editing a row edits the
  // page, and typing a heading into the page adds a row.
  const nodes = documentNodes;

  // Parents, children and subtree bounds, resolved once per outline instead of
  // by re-scanning the flat list for every row that asks.
  const tree = useMemo(() => indexOutline(nodes), [nodes]);
  /* The sections the active row sits inside, each with how far above it is.
     Lighting only the active row tells you where the caret is but not where
     that *is*: in a deep outline a lit third-level row, with its parents
     looking identical to every other row, leaves you scanning upward to work
     out which chapter you are in. */
  const ancestors = useMemo(() => ancestorDepths(tree, activeId), [tree, activeId]);

  /*
   * How much is written under each heading, keyed by where the heading is.
   *
   * By title, this was wrong twice over. Two sections may legitimately share a
   * name — an outline with four "Overview" rows gave all four the first one's
   * count, and marked all four written as soon as any one of them was. And the
   * per-title helper rebuilt the whole outline on every call, so drawing the
   * rail cost one full scan of the document per row. This is one pass.
   */
  const words = useMemo(() => sectionWords(tree, content, format), [content, format, tree]);

  /**
   * What a row has written *itself*.
   *
   * A parent's prose stops at its first child. Counting the subtree instead
   * marked every chapter heading written the moment anything under it was,
   * which made the coverage count a tally of nothing: a document of eight
   * headings and one paragraph read as "5 of 16 written".
   */
  const wordsOf = (node: OutlineNode) => words.own.get(node.offset) ?? 0;
  /** What deleting a row would take with it — its children included. */
  const subtreeWordsOf = (node: OutlineNode) => words.subtree.get(node.offset) ?? 0;

  /**
   * Which button opened the write popover.
   *
   * A node writes that section; `'missing'` and `'all'` are the two bulk
   * scopes. Nothing is requested until the popover is submitted, so the ✨ is
   * now "ask me how", not "go".
   */
  const [asking, setAsking] = useState<OutlineNode | 'missing' | 'all' | null>(null);
  const promptRef = useRef<HTMLInputElement>(null);

  const rows = useOutlineRows({
    nodes,
    childrenOf: node => {
      const index = tree.byOffset.get(node.offset);
      return index === undefined ? [] : childTitles(tree, index);
    },
    wordsOf: subtreeWordsOf,
    onRenameHeading, onShiftHeading, onMoveHeading, onAddHeading, onDeleteSection,
  });

  const writer = useSectionWriter({
    format, projectName, tree, wordsOf, onInsertSection, onFocusSection,
  });

  const written = nodes.filter(node => wordsOf(node) > 0).length;
  const totalWords = nodes.reduce((sum, node) => sum + wordsOf(node), 0);
  const coverage = nodes.length ? Math.round((written / nodes.length) * 100) : 0;

  const startResize = useDragResize({
    from: () => width,
    to: (dx, start) => Math.min(Math.max(start + dx, MIN_OUTLINE_WIDTH), MAX_OUTLINE_WIDTH),
    onChange: onWidth,
  });

  // ── AI over the structure ───────────────────────────────────────────────
  /**
   * One entry point, because there was never more than one intention behind
   * the two buttons this replaced.
   *
   * "AI outline" and "Refine" asked the same question — what should this
   * document's structure be — and differed only in whether a structure already
   * existed. That is not something the writer should have to classify: with no
   * outline the instruction is a subject, with one it is a change, and both
   * come back as a proposal to accept or discard.
   */
  const runOutlineAi = async (instruction: string, fromDraft = false) => {
    if (fromDraft && !content.trim()) {
      toast.info('Write something first — this reads the page you already have.');
      return;
    }
    if (!fromDraft && !nodes.length && !instruction.trim()) return;

    setWorking(true);
    try {
      if (fromDraft) {
        const plan = await outlineDraft(content, format);
        setProposal({ summary: `Read the draft and proposed ${plan.length} sections.`, plan, changes: [] });
      } else if (nodes.length) {
        // There is a structure, so this is a change to it — and the model is
        // told what each row already costs, since moving a section carrying
        // 900 words is not the same proposition as moving an empty heading.
        const result = await refinePlan(
          nodes.map(node => ({ title: node.label, level: node.level, words: wordsOf(node) })),
          projectName,
          instruction,
          format,
        );
        if (!result.changes.length) {
          toast.info(result.summary || 'The model left the structure as it was.');
        }
        setProposal(result);
      } else {
        const plan = await fetchHierarchy(instruction);
        setProposal({ summary: `Proposed ${plan.length} sections.`, plan, changes: [] });
      }
      setPromptOpen(false);
      setPromptValue('');
    } catch (error) {
      toast.error(errorMessage(error, 'The outline request failed'));
    } finally {
      setWorking(false);
    }
  };

  const applyProposal = () => {
    if (!proposal) return;
    onApplyOutline(proposal.plan);
    rows.closeEdit();
    onFocusSection(null);
    setProposal(null);
  };

  const addAtEnd = () => rows.addAfter(nodes[nodes.length - 1] ?? null);

  /**
   * Rewriting every section replaces prose that is already there, so it asks
   * first — the same confirm deleting a section gets, counting the same thing
   * it puts at risk. Writing only the empty ones takes nothing away and goes
   * straight through.
   */
  const rewriteEverything = (instruction: string) => {
    if (!written) { writer.writeAll('all', instruction); return; }
    toast(`Rewrite all ${nodes.length} sections?`, {
      description: `${totalWords} words across ${written} written section${written === 1 ? '' : 's'} will be replaced.`,
      action: { label: 'Rewrite all', onClick: () => writer.writeAll('all', instruction) },
      cancel: { label: 'Cancel', onClick: () => {} },
    });
  };

  /** What the popover is about to act on, and the verb for it. */
  const askTarget = asking === 'missing'
    ? `${writer.missing} empty section${writer.missing === 1 ? '' : 's'}`
    : asking === 'all'
      ? `all ${nodes.length} section${nodes.length === 1 ? '' : 's'}`
      : asking?.label ?? '';

  const runAsk = ({ instruction, method, urls }: WriteRequest) => {
    writer.setMethod(method);
    writer.setUrls(urls);
    const target = asking;
    setAsking(null);
    if (target === 'missing') writer.writeAll('missing', instruction);
    else if (target === 'all') rewriteEverything(instruction);
    else if (target) writer.writeSection(target, instruction);
  };

  /** Every row gesture points the document at the row it is acting on. */
  const touching = (node: OutlineNode, run: () => void) => () => { onFocusSection(node); run(); };

  const submitLabel = nodes.length ? 'Update outline' : 'Build outline';
  const canSubmit = !working && (nodes.length > 0 || promptValue.trim().length > 0);

  return (
    /* As a drawer the rail sizes itself from the viewport, so the stored width
       — a number chosen on a wide screen — is not applied. */
    <aside className="outline-rail" data-drawer={compact || undefined} style={compact ? undefined : { width }}>
      {/* The count is the rail's one piece of status: how much of the
          structure is actually written. It says so in words — a bare "5/16"
          in a pill is a number with no unit, and the tooltip that explained
          it only reached people who already suspected it meant something. */}
      <div className="outline-head">
        <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Outline</span>
        {nodes.length > 0 && (
          <span
            className="outline-count"
            title={`${written} of ${nodes.length} sections written · ${totalWords} words`}
          >
            {written}/{nodes.length} written
          </span>
        )}
        <IconButton className="ml-auto" onClick={onClose} title="Hide outline  ⌘\" aria-label="Hide outline">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {/* Written-ness, once, as a line — rather than as a tick repeated down
          every row of the list. */}
      {nodes.length > 0 && (
        <div className="outline-meter" role="presentation">
          <div className="outline-meter-fill" style={{ width: `${coverage}%` }} />
        </div>
      )}

      <div className="outline-actions">
        <button
          className="orail-btn"
          onClick={() => { setPromptOpen(open => !open); setPromptValue(''); }}
          data-active={promptOpen}
          disabled={working}
          title={nodes.length ? 'Change the structure with an instruction' : 'Build the structure from a subject'}
        >
          {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          AI outline
        </button>
      </div>

      {promptOpen && (
        <form
          className="orail-prompt"
          onSubmit={event => { event.preventDefault(); runOutlineAi(promptValue); }}
        >
          <input
            ref={promptRef}
            className="orail-input" autoFocus
            placeholder={nodes.length
              ? 'Add a section on…, reorder, split, trim'
              : 'What is this document about?'}
            value={promptValue} onChange={event => setPromptValue(event.target.value)}
          />

          {/* Openers rather than presets: each one leaves the box editable, so
              the common instructions cost a click and the unusual ones still
              cost a sentence. */}
          {nodes.length > 0 && (
            <div className="orail-chips">
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion.label}
                  type="button"
                  className="orail-chip"
                  title={suggestion.text.trim()}
                  onClick={() => {
                    setPromptValue(suggestion.text);
                    // A prefix is only useful if the caret is waiting at the
                    // end of it; a complete instruction is ready to submit.
                    if (suggestion.unfinished) {
                      requestAnimationFrame(() => {
                        const el = promptRef.current;
                        el?.focus();
                        el?.setSelectionRange(suggestion.text.length, suggestion.text.length);
                      });
                    }
                  }}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}

          <div className="orail-prompt-row">
            <button type="submit" className="orail-go" disabled={!canSubmit}>
              {submitLabel}
            </button>
            <button type="button" className="orail-link" onClick={() => runOutlineAi('', true)}
              disabled={working}>
              From what I've written
            </button>
          </div>
          {nodes.length > 0 && (
            <p className="orail-note">Leave it blank to let the model decide what to change.</p>
          )}
        </form>
      )}

      {proposal && (
        <OutlineProposal
          proposal={proposal}
          onApply={applyProposal}
          onDiscard={() => setProposal(null)}
        />
      )}

      {nodes.length === 0 ? (
        // The only place the instructions live. They used to be pinned to the
        // foot for the life of the document, where they were onboarding copy
        // that never stopped onboarding; here they appear exactly while they
        // are the thing you need.
        <div className="outline-empty">
          <ListTree className="h-6 w-6" aria-hidden="true" />
          <p className="outline-empty-title">No structure yet</p>
          <p>Add sections by hand, or build the whole shape with <b>AI outline</b>.</p>
          <button className="orail-add" onClick={() => rows.addAfter(null)}>
            <Plus className="h-3.5 w-3.5" /> Add the first section
          </button>
        </div>
      ) : (
        // A real list, so the count is announced and rows are navigable as
        // items rather than as a run of anonymous buttons. The gestures are
        // named here because they are mouse-only and appear in no menu.
        <div
          className="outline-list"
          role="list"
          aria-label={`Outline, ${nodes.length} sections`}
          title="Click to jump · double-click to rename · drag to reorder"
        >
          {nodes.map(node => (
            <OutlineRow
              key={node.id}
              item={{ id: node.id, title: node.label, level: node.level }}
              status={writer.status[node.offset]}
              words={wordsOf(node)}
              // Identity is the node, never its text. Comparing titles lit up
              // every row that happened to be called the same thing — an
              // outline of h2/h3 headings highlighted half the rail at once.
              active={node.id === activeId}
              ancestorDepth={ancestors.get(node.id)}
              busy={writer.busy}
              /* The row button opens the popover, and the popover is where a
                 URL would be entered — so it can never be blocked on one. */
              canGenerate
              editing={rows.editingOffset === node.offset}
              value={rows.editValue}
              onValue={rows.setEditValue}
              onEdit={touching(node, () => rows.startEdit(node))}
              onCommit={rows.commitEdit}
              onKeyDown={rows.editKeys(node)}
              onPrimary={touching(node, () => onJump(node))}
              onGenerate={touching(node, () => setAsking(node))}
              onIndent={touching(node, () => onShiftHeading(node.offset, 1))}
              onOutdent={touching(node, () => onShiftHeading(node.offset, -1))}
              onAddAfter={touching(node, () => rows.addAfter(node))}
              onDelete={() => rows.deleteRow(node)}
              dragging={rows.dragOffset === node.offset}
              dropEdge={rows.dropAt?.offset === node.offset ? rows.dropAt.edge : null}
              onDragStart={rows.rowDragStart(node)}
              onDragOver={rows.rowDragOver(node)}
              onDrop={event => { onFocusSection(null); rows.rowDrop(node)(event); }}
              onDragEnd={rows.endDrag}
            />
          ))}
          {/* Adding belongs at the end of the list, not pinned to the bottom
              of the rail: it appends *there*, and putting the control where
              its result appears is what stops it reading as a third,
              unrelated "add" — the head icon and the foot button were the
              other two, and both are gone. */}
          <button className="orail-add-row" onClick={addAtEnd} title="Add a section at the end">
            <Plus className="h-3 w-3" aria-hidden="true" /> Add section
          </button>
        </div>
      )}

      <div className="outline-foot">
        {/* The three-way source switch used to live here, permanently, above
            the button it configured — a setting you had to get right *before*
            knowing which section you were about to write, and the only place
            in the product where "how should this be written" could not be
            answered at all. Both now live in the popover that opens from the
            button that uses them. */}

        {writer.progress ? (
          <div className="gen-run">
            <div className="gen-progress">
              <div className="gen-progress-fill"
                style={{ width: `${(writer.progress.done / writer.progress.total) * 100}%` }} />
            </div>
            {/* Which section, not just how many. A bar that says 3/7 during a
                four-minute run tells the writer nothing about what is landing
                in their document. */}
            <p className="gen-now" title={writer.progress.title}>
              Writing <b>{writer.progress.title}</b>
            </p>
            <button className="orail-primary orail-primary--stop" onClick={writer.stop}>
              Stop · {writer.progress.done}/{writer.progress.total}
            </button>
          </div>
        ) : (
          <>
            {/* The default writes what is *missing*. The single button here
                used to rewrite every section every time, so adding one heading
                to a finished draft and pressing the only control in the foot
                regenerated the whole document — and the written/total count
                above it had no bearing on what the button did. Rewriting
                everything is still available; it is just no longer the thing
                that happens by default. */}
            <button
              className="orail-primary"
              onClick={() => setAsking(writer.missing ? 'missing' : 'all')}
              disabled={writer.busy || !nodes.length}
              title={writer.missing
                ? 'Write the sections that have no content yet'
                : 'Every section has content — this rewrites them all'}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {writer.missing
                ? `Write ${writer.missing} empty section${writer.missing === 1 ? '' : 's'}`
                : `Rewrite all ${nodes.length} section${nodes.length === 1 ? '' : 's'}`}
            </button>

            {writer.missing > 0 && written > 0 && (
              <button
                className="orail-link orail-foot-link"
                onClick={() => setAsking('all')}
                disabled={writer.busy}
                title="Regenerate every section, replacing what is already written"
              >
                Rewrite all {nodes.length} instead
              </button>
            )}
          </>
        )}
      </div>

      {asking && (
        /* Over the rail, not over the document: everything it configures lives
           here, and covering the prose to ask about the prose is the mistake
           the inline panel had to be rescued from. */
        <div className="write-pop-scrim" onClick={() => setAsking(null)}>
          <WritePopover
            target={askTarget}
            bulk={asking === 'missing' || asking === 'all'}
            rewriting={asking === 'all' || (typeof asking !== 'string' && wordsOf(asking) > 0)}
            method={writer.method}
            onMethod={writer.setMethod}
            urls={writer.urls}
            onUrls={writer.setUrls}
            onWrite={runAsk}
            onClose={() => setAsking(null)}
          />
        </div>
      )}

      {/* Nothing to resize against when the rail is a drawer, and a col-resize
          handle over the document's left edge on a touch screen is a trap. */}
      {!compact && (
        <div className="outline-resize" onMouseDown={startResize} role="separator" aria-label="Resize outline" />
      )}
    </aside>
  );
}
