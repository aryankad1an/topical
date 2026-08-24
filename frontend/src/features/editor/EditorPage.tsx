import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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
  renameSection, sectionWordCount, shiftSection,
} from './lib/sections';
import { countWords, documentStats } from './lib/stats';
import { caretPosition, caretIndexFromPoint, insertBlock, lineAt, offsetOfLine, separatorFor, type EditResult } from './lib/textOps';
import type { DocFormat } from '@/lib/types';
import type { EditorAction } from './lib/actions';
import { copyText, downloadSource, printPreview, wrapLatexDocument } from './lib/exporters';
import { DEFAULT_OPTIONS, loadOptions, saveOptions, type ViewMode, type ViewOptions } from './lib/viewOptions';

/**
 * The writing screen.
 *
 * Composition only: the document lives in `useDocument`, text operations in
 * `lib/textOps`, and each region of the screen in its own component. What is
 * left here is how they talk to each other — which is the part that actually
 * needs to be read in one place.
 */
export function EditorPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const doc = useDocument(user?.username || user?.given_name || 'Anonymous');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef('');
  const linesRef = useRef<HTMLPreElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [options, setOptions] = useState<ViewOptions>(DEFAULT_OPTIONS);
  const [splitRatio, setSplitRatio] = useState(50);
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
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
  const updateOptions = useCallback((patch: Partial<ViewOptions>) => {
    setOptions(prev => {
      const next = { ...prev, ...patch };
      saveOptions(next);
      return next;
    });
  }, []);

  const editing = useTextEditing({
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
  const activeLabel = useMemo(() => {
    const id = activeNode(outline, caret);
    return outline.find(node => node.id === id)?.label ?? null;
  }, [caret, outline]);

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
  }, [doc.content, focusLines, viewMode]);
  const selectedWords = useMemo(
    () => (selection.end > selection.start ? countWords(doc.content.slice(selection.start, selection.end), doc.format) : 0),
    [doc.content, doc.format, selection],
  );

  // ── Find & replace ──────────────────────────────────────────────────────
  const revealOffset = useCallback((offset: number) => {
    const ta = textareaRef.current;
    const pre = linesRef.current;
    if (!ta) return;
    const line = lineAt(doc.content, offset).number;
    const lineEl = pre?.children[line] as HTMLElement | undefined;
    if (lineEl) ta.scrollTop = Math.max(0, lineEl.offsetTop - ta.clientHeight / 3);
    ta.focus();
    ta.setSelectionRange(offset, offset);
    setCaret(offset);
  }, [doc.content]);

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
    onReplace: (next, at) => editing.apply({ content: next, start: at, end: at }),
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
    enabled: options.syncScroll && viewMode === 'split',
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
    editing.apply(result);
  }, [editing]);

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

  /** How much prose a delete would take with it, for the warning. */
  const measureSection = useCallback(
    (title: string) => sectionWordCount(contentRef.current, doc.format, title),
    [doc.format],
  );

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
    editing.apply({
      content: doc.content.slice(0, start) + text + doc.content.slice(end),
      start,
      end: start + text.length,
    });
  }, [doc.content, editing, selection]);

  // ── Popover anchoring, measured from the mirror's per-line elements ─────
  const anchorForOffset = useCallback((offset: number) => {
    const pre = linesRef.current;
    const surface = surfaceRef.current;
    if (!pre || !surface) return null;
    const lineEl = pre.children[lineAt(doc.content, offset).number] as HTMLElement | undefined;
    if (!lineEl) return null;
    const line = lineEl.getBoundingClientRect();
    const box = surface.getBoundingClientRect();
    return {
      x: Math.max(12, Math.min(line.left - box.left + 8, box.width - 340)),
      y: Math.max(8, Math.min(line.bottom - box.top + 8, box.height - 80)),
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
    editing.apply(action.apply(stripped, { start: slash.start, end: slash.start }));
  }, [doc.content, editing, slash]);

  const handleDropText = useCallback((text: string, clientX: number, clientY: number) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const at = caretIndexFromPoint(ta, clientX, clientY);
    editing.apply(insertBlock(doc.content, text, at, separatorFor(doc.format)));
    toast.success('Dropped into the document');
  }, [doc.content, doc.format, editing]);

  // ── Global shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();

      if (key === 's') { event.preventDefault(); doc.save(); }
      if (key === '\\') { event.preventDefault(); updateOptions({ outline: !options.outline }); }
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
          setAssistOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [assistOpen, doc, find, options.outline, syncSelection, updateOptions]);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = useCallback((kind: 'source' | 'copy' | 'print') => {
    const body = doc.format === 'latex' ? wrapLatexDocument(doc.name, doc.content) : doc.content;
    if (kind === 'source') {
      downloadSource(doc.name, body, doc.format);
      toast.success('Downloaded');
    } else if (kind === 'copy') {
      copyText(body).then(() => toast.success('Copied to clipboard'));
    } else {
      if (viewMode === 'code') setViewMode('split');
      // Let the preview paint before the print dialog samples the page.
      requestAnimationFrame(() => printPreview());
    }
  }, [doc.content, doc.format, doc.name, viewMode]);

  if (doc.isLoading) {
    return (
      <div className="editor-loading">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent-500)' }} />
      </div>
    );
  }

  const showEditor = viewMode !== 'preview';
  const showPreview = viewMode !== 'code';
  const hasSelection = selection.end > selection.start;

  return (
    <div className="editor-root">
      <EditorHeader
        name={doc.name}
        onRename={doc.setName}
        authorUsername={doc.authorUsername}
        coAuthorUsernames={doc.coAuthorUsernames}
        isAuthor={doc.isAuthor}
        onManageCoAuthors={() => setShowShare(true)}
        peers={doc.peers}
        isSaving={doc.saveState === 'saving'}
        isDirty={doc.saveState === 'dirty'}
        onSave={() => doc.save()}
        onBack={() => navigate({ to: '/projects' })}
        onUndo={() => { textareaRef.current?.focus(); document.execCommand('undo'); }}
        onRedo={() => { textareaRef.current?.focus(); document.execCommand('redo'); }}
        viewMode={viewMode}
        onViewMode={setViewMode}
        options={options}
        onOptions={updateOptions}
        onExport={handleExport}
      />

      {showEditor && (
        <Toolbar
          format={doc.format}
          onRun={editing.run}
          onUploadImage={() => setShowImage(true)}
          outlineOpen={options.outline}
          onToggleOutline={() => updateOptions({ outline: !options.outline })}
          onShowShortcuts={() => setShowShortcuts(true)}
        />
      )}

      <ShortcutsSheet
        open={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        format={doc.format}
      />

      <FindBar find={find} />

      <div className="editor-main" ref={mainRef}>
        {showEditor && options.outline && (
          <OutlineRail
            format={doc.format}
            projectName={doc.name}
            content={doc.content}
            documentNodes={outline}
            activeLabel={activeLabel}
            width={options.outlineWidth}
            onWidth={next => updateOptions({ outlineWidth: next })}
            onClose={() => updateOptions({ outline: false })}
            onJump={goToSection}
            onFocusSection={node => setFocusOffset(node ? node.offset : null)}
            onInsertSection={insertSection}
            onDeleteSection={deleteSection}
            measureSection={measureSection}
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
              onKeyDown={editing.onKeyDown}
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
                    editing.apply(insertBlock(doc.content, text, selection.end, separatorFor(doc.format)));
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

        {showPreview && (
          <div className="editor-preview" style={{ flex: showEditor ? 100 - splitRatio : 100 }}>
            <PreviewPane
              ref={previewRef}
              content={doc.content}
              format={doc.format}
              onJumpToLine={line => revealOffset(offsetOfLine(doc.content, line))}
            />
          </div>
        )}
      </div>

      <StatusBar
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
          editing.apply(insertBlock(doc.content, markup, at, separatorFor(doc.format)));
        }}
      />
    </div>
  );
}
