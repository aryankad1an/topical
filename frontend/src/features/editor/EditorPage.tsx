import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCompactEditor } from '@/hooks/useMediaQuery';
import type { LessonPlanResponse } from '@/lib/api';
import { documentShareUrl } from '@/lib/documentUrl';
import { useDocument } from './hooks/useDocument';
import { useTextEditing } from './hooks/useTextEditing';
import { useFindReplace } from './hooks/useFindReplace';
import { useScrollSync } from './hooks/useScrollSync';
import { useDragResize } from './hooks/useDragResize';
import { EditorHeader } from './components/EditorHeader';
import { Toolbar } from './components/Toolbar';
import { ShortcutsSheet } from './components/ShortcutsSheet';
import { CodeSurface } from './components/CodeSurface';
import { PreviewPane } from './components/PreviewPane';
import { OutlineRail } from './components/OutlineRail';
import { StatusBar } from './components/StatusBar';
import { FindBar } from './components/FindBar';
import { SlashMenu } from './components/SlashMenu';
import { AiAssist } from './components/AiAssist';
import { CoAuthorsDialog } from './components/CoAuthorsDialog';
import { ImageDialog } from './components/ImageDialog';
import { PeerCursors } from './components/PeerCursors';
import { activeNode, buildOutline, type OutlineNode } from './lib/outline';
import { indexOutline, subtreeSpan } from './lib/tree';
import {
  addSectionAfter, applyOutline, dropSection, moveSectionTo, placeSection,
  renameSection, shiftSection,
} from './lib/sections';
import { countWords, documentStats } from './lib/stats';
import { alignPrefixToSource } from './lib/sourceAlign';
import { caretPosition, caretIndexFromPoint, insertBlock, lineAt, offsetOfLine, separatorFor, type EditResult } from './lib/textOps';
import { LATEX_PREFIX, type DocFormat } from '@/lib/types';
import type { EditorAction } from './lib/actions';
import { copyText, downloadSource, printPreview, wrapLatexDocument } from './lib/exporters';
import { ExportPdfDialog } from './components/ExportPdfDialog';
import { DEFAULT_OPTIONS, loadOptions, saveOptions, type ViewMode, type ViewOptions } from './lib/viewOptions';

/**
 * The box a single character occupies inside one of the mirror's line
 * elements, `column` characters in.
 *
 * A collapsed DOM Range rather than arithmetic on the line's own box: the
 * surface soft-wraps, and the mirror paints each line as a run of syntax
 * spans, so neither the visual row nor the x position of a character can be
 * derived from the line without asking the browser where it actually put it.
 *
 * Returns null for a column past the end of the line's text — an empty line,
 * or a caret resting on the trailing newline — and the caller falls back to
 * the line's own box, which is the right answer in both cases.
 */
function rectForOffset(lineEl: HTMLElement, column: number): DOMRect | null {
  const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT);
  let seen = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const length = node.textContent?.length ?? 0;
    if (seen + length >= column) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, Math.min(column - seen, length)));
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      // A collapsed range in an empty text node measures zero on every axis;
      // there is nothing to point at, so let the caller use the line.
      if (rect.height > 0) return rect;
      return null;
    }
    seen += length;
  }
  return null;
}

export interface DocumentViewProps {
  /** The document, already loaded and access-checked by the route. */
  plan: LessonPlanResponse;
  /**
   * Whether this viewer owns the document.
   *
   * From the server, not inferred. This used to be decided with
   * `!authorUsername || authorUsername === currentUsername` — which reads
   * "nobody is named as the author, so it must be me". A document whose owner
   * has not set a username has no `authorUsername`, so every co-author on it
   * was treated as the owner: shown "by you" in the byline, and offered the
   * control that manages who else can edit.
   */
  isOwner: boolean;
  /** Whether the writing surface is live, or this is the reading view. */
  editing: boolean;
  /** Start writing. Absent for a viewer who may not. */
  onEdit?: () => void;
  /** Up one level: to reading from writing, or out to the projects list. */
  onBack: () => void;
}

/**
 * The document screen — reading and writing are two modes of it, not two
 * screens.
 *
 * There was briefly a separate reading page with a bar of its own, which was a
 * duplicate of a view this component already had: the editor's own Write /
 * Split / Read switch. Two implementations of "show me this document rendered"
 * is one too many, and they had already drifted — the reading page carried a
 * copy-link button the editor lacked, and the editor's preview had measure and
 * type-scaling rules the reading page did not.
 *
 * So the shell is one thing. Writing adds to it rather than replacing it:
 * reading is the same header, the same rendered sheet and the same export
 * menu, with the switch narrowed to its one reachable option and everything
 * that acts on text — the formatting toolbar, undo, save, find, the AI
 * surfaces, the outline rail — simply absent.
 *
 * Composition only: the document lives in `useDocument`, text operations in
 * `lib/textOps`, and each region of the screen in its own component.
 */
export function DocumentView({ plan, isOwner, editing, onEdit, onBack }: DocumentViewProps) {
  const { user } = useAuth();
  const doc = useDocument(user?.username || user?.given_name || 'Anonymous', plan, editing);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef('');
  const linesRef = useRef<HTMLPreElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  /**
   * Below ~900px the editor shows one pane at a time.
   *
   * A layout decision rather than a stylistic one, which is why it is here and
   * not a media query. Hiding the second pane in CSS leaves it mounted: the
   * Markdown renderer, KaTeX, the highlighter and the collaborative cursor
   * overlay all keep running for a pane nobody can see, on exactly the devices
   * least able to afford them.
   */
  const compact = useCompactEditor();
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showPdf, setShowPdf] = useState(false);
  const [options, setOptions] = useState<ViewOptions>(DEFAULT_OPTIONS);
  /** The outline rail, open over the document rather than beside it. */
  const [railOpen, setRailOpen] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  /**
   * Opened *with* a selection, so losing the selection closes it.
   *
   * Clicking into the text to deselect left the panel sitting over the page
   * with a header reading "0 words selected" and every action pointed at
   * nothing. "Continue writing" is the one action that legitimately works from
   * a bare caret, so a panel opened at the caret is left alone.
   */
  const assistNeedsSelection = useRef(false);
  const [showShare, setShowShare] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // The palette can reach the shortcut sheet, which only the editor owns.
  useEffect(() => {
    if (!editing) return;
    const open = () => setShowShortcuts(true);
    window.addEventListener('topical:shortcuts', open);
    return () => window.removeEventListener('topical:shortcuts', open);
  }, [editing]);
  /**
   * The heading of the section the outline rail is acting on.
   *
   * Reshaping a row used to change the document with nothing on screen
   * connecting the row to the text it stands for — the writer indented a
   * heading in the rail and had to go looking for what had moved. Holding the
   * offset here lets both panes mark the section instead.
   */
  const [focusOffset, setFocusOffset] = useState<number | null>(null);

  useEffect(() => { contentRef.current = doc.content; }, [doc.content]);

  useEffect(() => { setOptions(loadOptions()); }, []);

  /*
   * Split is not offered when there is no room for it.
   *
   * The stored preference is left alone: a writer who works in split on a
   * desktop and narrows the window should find split again when they widen it,
   * so this coerces what is *shown* rather than rewriting what was chosen.
   */
  const effectiveMode: ViewMode = !editing
    ? 'preview'
    : compact && viewMode === 'split'
      ? 'code'
      : viewMode;

  // A drawer that stays open across a route change would cover the next
  // document; closing it when the layout stops being compact is the same idea.
  useEffect(() => { if (!compact) setRailOpen(false); }, [compact]);

  /**
   * One control, two meanings — because the rail is two different things.
   *
   * Wide, it is a column of the layout and whether it is there is a stored
   * preference. Narrow, it is a drawer over the document, and "leave it open"
   * is not a preference anyone wants remembered: it would cover the writing
   * surface on every document they opened afterwards.
   */
  const toggleOutline = useCallback(() => {
    if (compact) setRailOpen(open => !open);
    else setOptions(prev => {
      const next = { ...prev, outline: !prev.outline };
      saveOptions(next);
      return next;
    });
  }, [compact]);
  const updateOptions = useCallback((patch: Partial<ViewOptions>) => {
    setOptions(prev => {
      const next = { ...prev, ...patch };
      saveOptions(next);
      return next;
    });
  }, []);

  const edits = useTextEditing({
    textareaRef,
    content: doc.content,
    setContent: doc.setContent,
    format: doc.format,
  });

  // ── Selection tracking ──────────────────────────────────────────────────
  const syncSelection = useCallback(() => {
    // The textarea's caret is unreliable mid-remote-update, and reporting it
    // then would jump every collaborator's cursor to the wrong place.
    if (doc.isRemoteUpdate.current) return;
    const ta = textareaRef.current;
    if (!ta) return;
    setCaret(ta.selectionStart);
    setSelection({ start: ta.selectionStart, end: ta.selectionEnd });
    doc.updateCursor(ta.selectionStart, ta.selectionEnd - ta.selectionStart);
  }, [doc]);

  // ── Derived views of the document ───────────────────────────────────────
  const outline = useMemo(() => buildOutline(doc.content, doc.format), [doc.content, doc.format]);
  const stats = useMemo(() => documentStats(doc.content, doc.format), [doc.content, doc.format]);
  const position = useMemo(() => caretPosition(doc.content, caret), [doc.content, caret]);
  const tree = useMemo(() => indexOutline(outline), [outline]);
  /**
   * The heading the caret is inside, as an id.
   *
   * This used to be resolved to a *label* and the rail compared titles, so a
   * document with more than one section of the same name showed every one of
   * them as the current section at once.
   */
  const activeId = useMemo(() => activeNode(outline, caret), [caret, outline]);

  /** The heading and everything nested under it — what one rail row stands for. */
  const focusSpan = useMemo(() => {
    if (focusOffset === null) return null;
    const index = tree.byOffset.get(focusOffset);
    return index === undefined ? null : subtreeSpan(tree, index, doc.content.length);
  }, [doc.content.length, focusOffset, tree]);

  /** The same span as source lines, which is what both panes can actually mark. */
  const focusLines = useMemo(() => {
    if (!focusSpan) return null;
    return {
      from: lineAt(doc.content, focusSpan.start).number,
      to: lineAt(doc.content, Math.max(focusSpan.start, focusSpan.end - 1)).number,
    };
  }, [doc.content, focusSpan]);

  /*
   * The mark follows the caret out of the section, and no further.
   *
   * Clearing it on any keystroke would drop it the moment the writer started
   * working in the section they had just gone to, which is the one time it is
   * useful; clearing it never would leave a stale highlight behind on the
   * previous section. Leaving the span is the event that actually means "I am
   * somewhere else now".
   */
  useEffect(() => {
    if (focusOffset === null) return;
    if (!focusSpan || caret < focusSpan.start || caret > focusSpan.end) setFocusOffset(null);
  }, [caret, focusOffset, focusSpan]);

  /*
   * The rendered half marks the same span. `data-line` is 1-based and only
   * present on tracked Markdown blocks, so this quietly does nothing for LaTeX
   * rather than needing a second implementation.
   */
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    const blocks = root.querySelectorAll<HTMLElement>('[data-line]');
    blocks.forEach(block => block.classList.remove('doc-focus'));
    if (!focusLines) return;
    blocks.forEach(block => {
      const line = Number(block.dataset.line) - 1;
      if (line >= focusLines.from && line <= focusLines.to) block.classList.add('doc-focus');
    });
  }, [doc.content, focusLines, effectiveMode]);
  const selectedWords = useMemo(
    () => (selection.end > selection.start ? countWords(doc.content.slice(selection.start, selection.end), doc.format) : 0),
    [doc.content, doc.format, selection],
  );

  // ── Putting the caret somewhere, visibly ────────────────────────────────
  /** Clears the flash below when the next one starts, or on unmount. */
  const flashTimer = useRef<number | null>(null);
  useEffect(() => () => { if (flashTimer.current) window.clearTimeout(flashTimer.current); }, []);

  /**
   * Move the caret to `offset` and make sure the writer can see it happen.
   *
   * Three things had to change here, and the order of the first two is the
   * whole bug: this used to set `scrollTop`, then `focus()`, then
   * `setSelectionRange` — and both of the last two scroll a textarea to its
   * selection on their own, so the carefully computed scroll position was
   * overwritten a line later by the browser's own idea of where to go. The
   * caret went to the right place and the view did not follow it, which is
   * exactly "I have to scroll around to find the pointer".
   *
   * It also measured `lineEl.offsetTop`, the top of the *logical* line. The
   * surface soft-wraps, so a caret two visual rows into a long paragraph is
   * nowhere near it. A collapsed Range over the mirror gives the real
   * position of that character, wrapping included — the mirror is glyph-for
   * -glyph identical to the textarea, which is the entire reason it exists.
   */
  const revealOffset = useCallback((offset: number) => {
    const ta = textareaRef.current;
    const pre = linesRef.current;
    if (!ta) return;

    // Selection first, then focus — after which the browser may have scrolled
    // the surface, so every measurement below has to happen afterwards.
    ta.setSelectionRange(offset, offset);
    ta.focus({ preventScroll: true });
    setCaret(offset);

    const line = lineAt(doc.content, offset);
    const lineEl = pre?.children[line.number] as HTMLElement | undefined;
    if (!pre || !lineEl) return;

    // The caret's y within the scrollable content — measured against the
    // mirror's own scroll position, so it does not matter whether the mirror
    // and the textarea have finished syncing.
    const paneTop = pre.getBoundingClientRect().top;
    const caretRect = rectForOffset(lineEl, offset - line.start) ?? lineEl.getBoundingClientRect();
    const caretY = caretRect.top - paneTop + pre.scrollTop;

    // Only move the view when the caret is not already comfortably inside it.
    // Scrolling on every click, including the ones that land on screen, reads
    // as the pane twitching for no reason.
    const margin = Math.min(80, ta.clientHeight / 4);
    const viewTop = ta.scrollTop;
    const viewBottom = viewTop + ta.clientHeight;
    if (caretY < viewTop + margin || caretY > viewBottom - margin) {
      ta.scrollTop = Math.max(0, caretY - ta.clientHeight * 0.4);
      pre.scrollTop = ta.scrollTop;
    }

    /*
     * A caret is one hairline in a wall of monospace, and it is not always
     * blinking — a writer whose focus was in the preview pane has no idea
     * which of these lines just became the current one. The line flashes once
     * so the eye is told where to look, then gets out of the way.
     */
    lineEl.classList.remove('cl-flash');
    // Reading back a layout property restarts the animation on a line that is
    // already flashing; without it, clicking twice in the same paragraph
    // flashes only the first time.
    void lineEl.offsetWidth;
    lineEl.classList.add('cl-flash');
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => lineEl.classList.remove('cl-flash'), 1200);
  }, [doc.content]);

  /**
   * Put the caret on the source character behind a click in the preview.
   *
   * `line` narrows it to a block; the rendered prefix is walked against the
   * source from there to find the character — see `lib/sourceAlign` for why
   * that is a text alignment rather than a lookup.
   */
  const jumpToSource = useCallback((line: number, prefix: string) => {
    const blockStart = offsetOfLine(doc.content, line);
    revealOffset(blockStart + alignPrefixToSource(doc.content.slice(blockStart), prefix));
  }, [doc.content, revealOffset]);

  /**
   * Go to a section and mark it, so the row that was clicked and the text it
   * stands for are visibly the same thing.
   *
   * The mark is a highlight rather than a text selection on purpose: selecting
   * a whole section puts the writer one keystroke away from replacing it, and
   * pops the inline-AI chip over the very text they came here to read.
   */
  const goToSection = useCallback((node: OutlineNode) => {
    setFocusOffset(node.offset);
    revealOffset(node.offset);
  }, [revealOffset]);

  const find = useFindReplace({
    content: doc.content,
    onReplace: (next, at) => edits.apply({ content: next, start: at, end: at }),
    onFocusMatch: match => {
      const ta = textareaRef.current;
      revealOffset(match.start);
      ta?.setSelectionRange(match.start, match.end);
    },
  });

  useScrollSync({
    textareaRef,
    linesRef,
    previewRef,
    enabled: options.syncScroll && effectiveMode === 'split',
    revision: doc.content,
  });

  // ── Placement helpers ───────────────────────────────────────────────────
  /**
   * Apply an edit that was computed against the newest text.
   *
   * "Generate all sections" inserts many sections without this component
   * re-rendering between them, so a value captured from `doc.content` goes
   * stale after the first one. Every section-level edit reads and writes
   * through the ref instead.
   */
  const applyToDocument = useCallback((result: EditResult) => {
    contentRef.current = result.content;
    edits.apply(result);
  }, [edits]);

  /**
   * Run one of `lib/sections`' operations against the newest text.
   *
   * Every structural edit shares the same two rules, and they are stated here
   * rather than at each call site: read the document through `contentRef`, and
   * apply the result only when the operation found something to change (they
   * return null when the heading isn't there). The first rule is the one that
   * matters — "generate all sections" runs many of these without this
   * component re-rendering in between, so an operation reading the `doc.content`
   * closure would work once and then silently edit stale text.
   */
  const editSections = useCallback(
    <Args extends unknown[], Result extends EditResult | null>(
      operation: (content: string, format: DocFormat, ...args: Args) => Result,
      ...args: Args
    ): Result => {
      const result = operation(contentRef.current, doc.format, ...args);
      if (result) applyToDocument(result);
      return result;
    },
    [applyToDocument, doc.format],
  );

  /** File a generated section under its own heading, or append it. */
  const insertSection = useCallback((text: string, title: string, replace = false) => {
    editSections(placeSection, title, text, replace);
  }, [editSections]);

  /** Remove a section and everything nested under it. */
  const deleteSection = useCallback((title: string) => {
    editSections(dropSection, title);
  }, [editSections]);

  /*
   * The outline rail's structural edits, applied to the document itself.
   *
   * The rail renders the document's headings rather than a copy of them, so
   * reshaping the outline *is* editing the page. There is no second structure
   * to reconcile, which is the only way the two stay in step under arbitrary
   * editing — including edits typed straight into the text.
   */
  const renameHeading = useCallback((offset: number, next: string) => {
    editSections(renameSection, offset, next);
  }, [editSections]);

  const shiftHeading = useCallback((offset: number, delta: 1 | -1) => {
    editSections(shiftSection, offset, delta);
  }, [editSections]);

  const moveHeading = useCallback((offset: number, target: number, edge: 'top' | 'bottom') => {
    editSections(moveSectionTo, offset, target, edge);
  }, [editSections]);

  /** Returns where the new heading landed, so the rail can open it to type in. */
  const addHeading = useCallback(
    (afterOffset: number | null) => editSections(addSectionAfter, afterOffset).headingOffset,
    [editSections],
  );

  /**
   * Rewrite the document so its headings match a proposed outline.
   *
   * Sections the proposal leaves out keep their prose and are moved to the end
   * rather than deleted — the writer is told how many, and can remove them
   * deliberately.
   */
  const applyProposedOutline = useCallback((plan: { title: string; level: number }[]) => {
    const { result, orphans } = applyOutline(contentRef.current, doc.format, plan);
    applyToDocument(result);
    if (orphans.length) {
      toast.info(
        `Structure updated — ${orphans.length} section${orphans.length === 1 ? '' : 's'} not in the outline moved to the end`,
        { description: orphans.slice(0, 4).join(', ') },
      );
    } else {
      toast.success('Structure updated');
    }
  }, [applyToDocument, doc.format]);

  /** The split between editor and preview, as a percentage of the shared row. */
  const startSplitDrag = useDragResize({
    from: () => splitRatio,
    to: (dx, start) => {
      // Measured against the row rather than the window, so the divider keeps
      // up with the pointer at any window size.
      const row = mainRef.current?.getBoundingClientRect().width ?? 1;
      return Math.min(Math.max(22, start + (dx / Math.max(row, 1)) * 100), 78);
    },
    onChange: setSplitRatio,
  });

  const replaceSelection = useCallback((text: string) => {
    const { start, end } = selection;
    edits.apply({
      content: doc.content.slice(0, start) + text + doc.content.slice(end),
      start,
      end: start + text.length,
    });
  }, [doc.content, edits, selection]);

  // A panel opened on a selection follows that selection out of existence.
  useEffect(() => {
    if (!assistOpen || !assistNeedsSelection.current) return;
    if (selection.end <= selection.start) setAssistOpen(false);
  }, [assistOpen, selection.start, selection.end]);

  // ── Popover anchoring, measured from the mirror's per-line elements ─────
  /**
   * The anchor line's box, in the surface's own coordinates.
   *
   * This used to return a finished `{x, y}` with the vertical clamped to
   * `box.height - 80` — a number that assumed the panel was 80px tall when it
   * is nearer 300. Anchoring near the foot of the surface therefore pinned the
   * panel 80px from the bottom, over the very text it was about, with most of
   * it cut off. It also only ever placed *below* the line, so there was no
   * case where it could move out of the way.
   *
   * The caller gets the line instead and decides, because only the caller
   * knows how tall it is.
   */
  const anchorForOffset = useCallback((offset: number) => {
    const pre = linesRef.current;
    const surface = surfaceRef.current;
    if (!pre || !surface) return null;
    const lineEl = pre.children[lineAt(doc.content, offset).number] as HTMLElement | undefined;
    if (!lineEl) return null;
    const line = lineEl.getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    return {
      x: line.left - box.left,
      lineTop: line.top - box.top,
      lineBottom: line.bottom - box.top,
      boxWidth: box.width,
      boxHeight: box.height,
    };
  }, [doc.content]);

  // ── Editing surface events ──────────────────────────────────────────────
  const handleChange = useCallback((value: string) => {
    doc.setContent(value);
    const ta = textareaRef.current;
    if (!ta) return;
    // `/` at the start of a word opens the insert menu, and keeps filtering
    // until whitespace ends the token.
    const before = value.slice(0, ta.selectionStart);
    const trigger = /(?:^|\s)\/([\w-]*)$/.exec(before);
    setSlash(trigger ? { start: ta.selectionStart - trigger[1].length - 1, query: trigger[1] } : null);
  }, [doc]);

  const runSlashAction = useCallback((action: EditorAction) => {
    const ta = textareaRef.current;
    if (!ta || !slash) return;
    // Drop the "/query" the user typed, then apply the action there.
    const stripped = doc.content.slice(0, slash.start) + doc.content.slice(ta.selectionStart);
    setSlash(null);
    edits.apply(action.apply(stripped, { start: slash.start, end: slash.start }));
  }, [doc.content, edits, slash]);

  const handleDropText = useCallback((text: string, clientX: number, clientY: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const at = caretIndexFromPoint(ta, clientX, clientY);
    edits.apply(insertBlock(doc.content, text, at, separatorFor(doc.format)));
    toast.success('Dropped into the document');
  }, [doc.content, doc.format, edits]);

  // ── Global shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    // Every binding below acts on the text. None of them means anything while
    // reading, and ⌘S in particular should stay the browser's own.
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === 's') { event.preventDefault(); doc.save(); }
      if (key === '\\') { event.preventDefault(); toggleOutline(); }
      if (key === 'f') { event.preventDefault(); find.setOpen(true); }
      // ⌘/ is the near-universal binding for "what are the shortcuts", and
      // toggling means the same key puts the sheet away again.
      if (key === '/') { event.preventDefault(); setShowShortcuts(open => !open); }
      // ⌘J both opens and dismisses — the same key that summoned it should
      // put it away, without reaching for Escape or the close button.
      if (key === 'j') {
        event.preventDefault();
        if (assistOpen) {
          setAssistOpen(false);
          textareaRef.current?.focus();
        } else {
          syncSelection();
          const ta = textareaRef.current;
          assistNeedsSelection.current = !!ta && ta.selectionEnd > ta.selectionStart;
          setAssistOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistOpen, doc, editing, find, syncSelection, toggleOutline]);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = useCallback((kind: 'link' | 'source' | 'copy' | 'print' | 'pdf') => {
    const body = doc.format === 'latex' ? wrapLatexDocument(doc.name, doc.content) : doc.content;
    if (kind === 'link') {
      // The document's own address, which is the same one whoever receives it
      // will open — reading or writing is decided at their end, from what the
      // server says they may do.
      copyText(documentShareUrl(plan.id, doc.format === 'latex' ? LATEX_PREFIX : ''))
        .then(() => toast.success('Link copied'))
        .catch(() => toast.error('Could not copy the link'));
    } else if (kind === 'source') {
      downloadSource(doc.name, body, doc.format);
      toast.success('Downloaded');
    } else if (kind === 'copy') {
      copyText(body).then(() => toast.success('Copied to clipboard'));
    } else if (kind === 'pdf') {
      // The dialog reads the rendered HTML when it submits, so the preview has
      // to exist. In code-only view it does not — and on a narrow window the
      // way to make it exist is `preview`, since `split` renders nothing there.
      if (effectiveMode === 'code') setViewMode(compact ? 'preview' : 'split');
      setShowPdf(true);
    } else {
      if (effectiveMode === 'code') setViewMode(compact ? 'preview' : 'split');
      // Let the preview paint before the print dialog samples the page.
      requestAnimationFrame(() => printPreview());
    }
  }, [compact, doc.content, doc.format, doc.name, effectiveMode, plan.id]);

  const showEditor = effectiveMode !== 'preview';
  const showPreview = effectiveMode !== 'code';
  /* Beside the document when there is room, over it when there is not. */
  const showRail = showEditor && (compact ? railOpen : options.outline);
  const hasSelection = selection.end > selection.start;

  return (
    <div className="editor-root">
      <EditorHeader
        name={doc.name}
        onRename={doc.setName}
        authorUsername={doc.authorUsername}
        coAuthorUsernames={doc.coAuthorUsernames}
        isAuthor={isOwner}
        onManageCoAuthors={() => setShowShare(true)}
        peers={doc.peers}
        isSaving={doc.saveState === 'saving'}
        isDirty={doc.saveState === 'dirty'}
        onSave={() => doc.save()}
        onBack={onBack}
        onUndo={() => { textareaRef.current?.focus(); document.execCommand('undo'); }}
        onRedo={() => { textareaRef.current?.focus(); document.execCommand('redo'); }}
        viewMode={effectiveMode}
        compact={compact}
        editing={editing}
        onEdit={onEdit}
        onViewMode={setViewMode}
        options={options}
        onOptions={updateOptions}
        onExport={handleExport}
      />

      {showEditor && (
        <Toolbar
          format={doc.format}
          onRun={edits.run}
          onUploadImage={() => setShowImage(true)}
          outlineOpen={compact ? railOpen : options.outline}
          onToggleOutline={toggleOutline}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
      )}

      {editing && (
        <ShortcutsSheet
          open={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          format={doc.format}
        />
      )}

      {editing && <FindBar find={find} />}

      <div className="editor-main" ref={mainRef}>
        {/* A scrim, only in the compact layout: there the rail is a drawer over
            the document, and a drawer that can be left open with no obvious way
            to close it is a trap. Wide, the rail is a column and dimming the
            page behind it would be nonsense. */}
        {compact && railOpen && (
          <div className="editor-rail-scrim" onClick={() => setRailOpen(false)} aria-hidden="true" />
        )}

        {showRail && (
          <OutlineRail
            format={doc.format}
            projectName={doc.name}
            content={doc.content}
            documentNodes={outline}
            activeId={activeId}
            compact={compact}
            width={options.outlineWidth}
            onWidth={next => updateOptions({ outlineWidth: next })}
            onClose={() => (compact ? setRailOpen(false) : updateOptions({ outline: false }))}
            onJump={goToSection}
            onFocusSection={node => setFocusOffset(node ? node.offset : null)}
            onInsertSection={insertSection}
            onDeleteSection={deleteSection}
            onRenameHeading={renameHeading}
            onShiftHeading={shiftHeading}
            onMoveHeading={moveHeading}
            onAddHeading={addHeading}
            onApplyOutline={applyProposedOutline}
          />
        )}

        {showEditor && (
          <div
            className="editor-pane"
            ref={surfaceRef}
            style={{ flex: showPreview ? splitRatio : 100 }}
          >
            <CodeSurface
              value={doc.content}
              onChange={handleChange}
              onKeyDown={edits.onKeyDown}
              onSelectionChange={syncSelection}
              onDropText={handleDropText}
              format={doc.format}
              textareaRef={textareaRef}
              linesRef={linesRef}
              finds={find.matches}
              activeFind={find.current}
              showLineNumbers={options.lineNumbers}
              focusMode={options.focusMode}
              fontSize={options.fontSize}
              caret={caret}
              sectionLines={focusLines}
              placeholder={doc.format === 'latex'
                ? '\\section{Introduction}\n\nStart writing — or press / for a menu of everything.'
                : '# Start here\n\nWrite, or press / for a menu of everything.'}
            >
              <PeerCursors textareaRef={textareaRef} content={doc.content} peers={doc.peers} />

              {slash && (
                <SlashMenu
                  format={doc.format}
                  query={slash.query}
                  anchor={anchorForOffset(slash.start)}
                  onPick={runSlashAction}
                  onClose={() => setSlash(null)}
                />
              )}

              {/* A quiet handle on the selection, rather than a panel that
                  ambushes every time you highlight a word. */}
              {hasSelection && !assistOpen && !slash && (
                <button
                  className="ai-chip"
                  style={anchorForOffset(selection.end) ?? undefined}
                  onClick={() => setAssistOpen(true)}
                >
                  <Sparkles className="h-3 w-3" /> Edit with AI <kbd>⌘J</kbd>
                </button>
              )}

              {assistOpen && (
                <AiAssist
                  anchor={anchorForOffset(hasSelection ? selection.end : caret)}
                  selection={selection}
                  content={doc.content}
                  format={doc.format}
                  title={doc.name}
                  onReplace={replaceSelection}
                  onInsertAfter={text => {
                    edits.apply(insertBlock(doc.content, text, selection.end, separatorFor(doc.format)));
                  }}
                  onClose={() => setAssistOpen(false)}
                />
              )}
            </CodeSurface>
          </div>
        )}

        {showEditor && showPreview && (
          // `role="separator"` with a tabindex is a *focusable* separator, which
          // is the one ARIA pattern that must also respond to the arrow keys —
          // a split a mouse can move and a keyboard cannot is not resizable.
          <div
            className="editor-divider"
            onMouseDown={startSplitDrag}
            role="separator"
            tabIndex={0}
            aria-label="Resize the writing and preview panes"
            aria-orientation="vertical"
            aria-valuenow={Math.round(splitRatio)}
            aria-valuemin={20}
            aria-valuemax={80}
            onKeyDown={event => {
              const step = event.shiftKey ? 10 : 2;
              if (event.key === 'ArrowLeft') setSplitRatio(r => Math.max(20, r - step));
              else if (event.key === 'ArrowRight') setSplitRatio(r => Math.min(80, r + step));
              else if (event.key === 'Home') setSplitRatio(50);
              else return;
              event.preventDefault();
            }}
          />
        )}

        {/* `data-split` so the rendered sheet can stop centring itself when
            there is a source pane beside it to be read against. */}
        {showPreview && (
          <div
            className="editor-preview"
            data-split={showEditor ? 'true' : undefined}
            style={{ flex: showEditor ? 100 - splitRatio : 100 }}
          >
            <PreviewPane
              ref={previewRef}
              content={doc.content}
              format={doc.format}
              editing={editing}
              fontSize={options.fontSize}
              /*
               * Clicking the rendered text moves the caret to the character
               * that produced it — but only in split, where the source pane is
               * right there to show it landing. In the full-screen preview
               * inside an editing session there is nothing to see it happen
               * in, and outside an editing session there is no caret at all.
               */
              onJumpToSource={showEditor ? jumpToSource : undefined}
            />
          </div>
        )}
      </div>

      {showPdf && (
        <ExportPdfDialog
          title={doc.name}
          author={user?.given_name ? [user.given_name, user.family_name].filter(Boolean).join(' ') : null}
          /* Read at submit time, not at open time: the preview keeps rendering
             while the dialog is up, and the export should carry whatever the
             document says when the button is actually pressed. */
          getHtml={() => document.querySelector('.doc-preview .doc-sheet')?.innerHTML ?? null}
          onClose={() => setShowPdf(false)}
        />
      )}

      <StatusBar
        editing={editing}
        saveState={doc.saveState}
        lastSavedAt={doc.lastSavedAt}
        stats={stats}
        line={position.line}
        column={position.column}
        selectedWords={selectedWords}
        connected={doc.connected}
        peerCount={doc.peers.length}
        format={doc.format}
      />

      {/* Both act on the document, so neither exists while reading it. */}
      {editing && (
        <>
          <CoAuthorsDialog
            open={showShare}
            onOpenChange={setShowShare}
            coAuthors={doc.coAuthors}
            coAuthorUsernames={doc.coAuthorUsernames}
            onChange={doc.setCoAuthors}
          />

          <ImageDialog
            open={showImage}
            onOpenChange={setShowImage}
            onInsert={url => {
              const at = textareaRef.current?.selectionStart ?? doc.content.length;
              const markup = doc.format === 'latex'
                ? `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${url}}\n\\end{figure}`
                : `![](${url})`;
              edits.apply(insertBlock(doc.content, markup, at, separatorFor(doc.format)));
            }}
          />
        </>
      )}
    </div>
  );
}
