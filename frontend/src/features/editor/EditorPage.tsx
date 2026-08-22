import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDocument } from './hooks/useDocument';
import { useTextEditing } from './hooks/useTextEditing';
import { useFindReplace } from './hooks/useFindReplace';
import { useScrollSync } from './hooks/useScrollSync';
import { EditorHeader } from './components/EditorHeader';
import { Toolbar } from './components/Toolbar';
import { CodeSurface } from './components/CodeSurface';
import { PreviewPane } from './components/PreviewPane';
import { OutlineRail } from './components/OutlineRail';
import { StatusBar } from './components/StatusBar';
import { FindBar } from './components/FindBar';
import { SlashMenu } from './components/SlashMenu';
import { AiAssist } from './components/AiAssist';
import { AiPanel } from './components/AiPanel';
import { CoAuthorsDialog } from './components/CoAuthorsDialog';
import { ImageDialog } from './components/ImageDialog';
import { PeerCursors } from './components/PeerCursors';
import { activeNode, buildOutline } from './lib/outline';
import { stripLeadingHeading } from './lib/plan';
import { countWords, documentStats } from './lib/stats';
import { caretPosition, caretIndexFromPoint, insertBlock, lineAt, offsetOfLine, separatorFor } from './lib/textOps';
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

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [options, setOptions] = useState<ViewOptions>(DEFAULT_OPTIONS);
  const [splitRatio, setSplitRatio] = useState(50);
  const [caret, setCaret] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [slash, setSlash] = useState<{ start: number; query: string } | null>(null);
  const [assistOpen, setAssistOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showImage, setShowImage] = useState(false);

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
  const insertAtCaret = useCallback((text: string, message?: string) => {
    const ta = textareaRef.current;
    const at = ta ? ta.selectionStart : doc.content.length;
    editing.apply(insertBlock(doc.content, text, at, separatorFor(doc.format)));
    if (message) toast.success(message);
  }, [doc.content, doc.format, editing]);

  /**
   * File a generated section under its own heading.
   *
   * Sections are written in whatever order they are clicked, so the heading
   * may already be in the page — drafted from the outline — or not exist yet.
   * Appending everything to the end would scatter sections away from the
   * structure the writer just laid out.
   */
  const insertSection = useCallback((text: string, title: string, replace = false) => {
    const current = contentRef.current;
    const nodes = buildOutline(current, doc.format);
    const target = nodes.find(
      node => node.label.trim().toLowerCase() === title.trim().toLowerCase(),
    );

    // Nothing to file it under: the section keeps its own heading and lands
    // at the end.
    if (!target) {
      const result = insertBlock(current, text.trim(), current.length, '\n\n');
      contentRef.current = result.content;
      editing.apply(result);
      return;
    }

    // The heading is already on the page, so the copy the model wrote would be
    // a duplicate. The body goes directly beneath its own heading — before the
    // *next heading of any level*, not at the end of the whole section. A
    // parent's introduction belongs above its subsections, not after them.
    const body = stripLeadingHeading(text, title, doc.format).trim();
    const following = nodes.find(node => node.offset > target.offset);
    const sectionEnd = following ? following.offset : current.length;

    // Rewriting a section that is already on the page replaces what is under
    // that heading. Appending instead would leave two versions of the same
    // section stacked on top of each other, which is never the intent behind
    // clicking a finished row again.
    if (replace) {
      const lineEnd = current.indexOf('\n', target.offset);
      const headingEnd = lineEnd === -1 ? current.length : lineEnd;
      const cleared = current.slice(0, headingEnd) + '\n' + current.slice(sectionEnd);
      const result = insertBlock(cleared, body, headingEnd + 1, '\n\n');
      contentRef.current = result.content;
      editing.apply(result);
      return;
    }

    const result = insertBlock(current, body, sectionEnd, '\n\n');
    contentRef.current = result.content;
    editing.apply(result);
  }, [doc.format, editing]);

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
      if (key === 'f') { event.preventDefault(); find.setOpen(true); }
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
  }, [assistOpen, doc, find, syncSelection]);

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
          aiOpen={aiPanelOpen}
          onToggleAi={() => setAiPanelOpen(open => !open)}
        />
      )}

      <FindBar find={find} />

      <div className="editor-main">
        <AiPanel
          open={aiPanelOpen}
          onClose={() => setAiPanelOpen(false)}
          format={doc.format}
          projectName={doc.name}
          content={doc.content}
          onInsert={insertAtCaret}
          onInsertSection={insertSection}
        />

        {showEditor && options.outline && (
          <OutlineRail
            nodes={outline}
            activeId={activeNode(outline, caret)}
            onJump={node => revealOffset(node.offset)}
            onClose={() => updateOptions({ outline: false })}
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
          <div
            className="editor-divider"
            onMouseDown={event => {
              event.preventDefault();
              const startX = event.clientX;
              const startRatio = splitRatio;
              // Measure against the row the panes actually share, not the
              // window — the outline rail and the AI panel are not in it.
              const row = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect().width;
              const onMove = (move: MouseEvent) => {
                const delta = ((move.clientX - startX) / Math.max(row, 1)) * 100;
                setSplitRatio(Math.min(Math.max(22, startRatio + delta), 78));
              };
              const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
              };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
            role="separator"
            aria-label="Resize panes"
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
