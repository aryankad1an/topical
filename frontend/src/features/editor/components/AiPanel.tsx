import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Cpu, Globe,
  Link2, ListTree, Loader2, PanelLeftClose, Pencil, Plus, Search, Sparkles, Trash2, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Chip, IconButton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import { fetchHierarchy, generateSection, outlineDraft, type GenerationMethod } from '../lib/generation';
import {
  addAfter, indent, move, outdent, planItem, planToDocument, remove, rename,
  type PlanItem,
} from '../lib/plan';

interface Props {
  open: boolean;
  onClose: () => void;
  format: DocFormat;
  projectName: string;
  /** Current document — used when outlining an existing draft. */
  content: string;
  /** Place text at the caret. */
  onInsert: (text: string, label: string) => void;
  /**
   * File a generated section under its own heading, appending it if that
   * heading isn't in the document yet.
   */
  onInsertSection: (text: string, title: string, replace: boolean) => void;
}

type TopicStatus = 'generating' | 'placed' | 'failed';

const METHODS: { key: GenerationMethod; icon: typeof Globe; label: string; hint: string }[] = [
  { key: 'crawl', icon: Globe, label: 'Web', hint: 'Research the topic online first' },
  { key: 'llm', icon: Cpu, label: 'Model', hint: "Use the model's own knowledge" },
  { key: 'urls', icon: Link2, label: 'URLs', hint: 'Ground it in pages you choose' },
];

interface RowProps {
  item: PlanItem;
  status?: TopicStatus;
  busy: boolean;
  editing: boolean;
  value: string;
  onValue: (next: string) => void;
  onEdit: () => void;
  onCommit: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onGenerate: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}

/**
 * One row of the plan: its own depth, how far it has got, and the handles for
 * changing it. Clicking the row writes the section; everything that edits the
 * outline instead lives in the hover rail, so the two never fire by accident.
 */
function PlanRow({
  item, status, busy, editing, value, onValue, onEdit, onCommit, onKeyDown,
  onGenerate, onIndent, onOutdent, onUp, onDown, onDelete,
}: RowProps) {
  const empty = !item.title.trim();
  const title = empty
    ? 'Name this section'
    : status === 'placed'
      ? `"${item.title}" is in your document — click to write it again`
      : status === 'failed'
        ? `"${item.title}" failed — click to try again`
        : `Write "${item.title}" into the document`;

  return (
    <div className="plan-row" data-status={status ?? 'idle'} style={{ paddingLeft: (item.level - 1) * 15 }}>
      <span className="plan-mark" aria-hidden>
        {status === 'generating' ? <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: 'var(--accent-500)' }} />
          : status === 'placed' ? <Check className="h-2.5 w-2.5" />
            : status === 'failed' ? <AlertTriangle className="h-2.5 w-2.5" /> : null}
      </span>

      {editing ? (
        <input
          className="plan-input"
          autoFocus
          value={value}
          placeholder="Section title"
          onChange={event => onValue(event.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
        />
      ) : (
        <button
          className="plan-name"
          data-empty={empty}
          disabled={busy || empty}
          onClick={onGenerate}
          onDoubleClick={onEdit}
          title={title}
        >
          {item.title || 'Untitled section'}
        </button>
      )}

      <span className="plan-tools">
        <button className="plan-tool" onClick={onOutdent} disabled={item.level <= 1} title="Outdent" aria-label="Outdent">
          <ChevronLeft className="h-3 w-3" />
        </button>
        <button className="plan-tool" onClick={onIndent} title="Indent" aria-label="Indent">
          <ChevronRight className="h-3 w-3" />
        </button>
        <button className="plan-tool" onClick={onUp} title="Move up" aria-label="Move up">
          <ChevronUp className="h-3 w-3" />
        </button>
        <button className="plan-tool" onClick={onDown} title="Move down" aria-label="Move down">
          <ChevronDown className="h-3 w-3" />
        </button>
        <button className="plan-tool" onClick={onEdit} title="Rename" aria-label="Rename">
          <Pencil className="h-3 w-3" />
        </button>
        <button className="plan-tool plan-tool--danger" onClick={onDelete} title="Delete" aria-label="Delete">
          <Trash2 className="h-3 w-3" />
        </button>
      </span>
    </div>
  );
}

/**
 * Long-form generation: turn a subject into an outline, shape that outline by
 * hand, then write each section straight into the document.
 */
export function AiPanel({
  open, onClose, format, projectName, content, onInsert, onInsertSection,
}: Props) {
  const [subject, setSubject] = useState('');
  const [method, setMethod] = useState<GenerationMethod>('crawl');
  const [urls, setUrls] = useState(['']);
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Record<string, TopicStatus>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Set while a "Generate all" run should wind down. A ref, not state: the loop
  // closes over its own render and would never observe a re-rendered flag.
  const stopRequested = useRef(false);

  const named = plan.filter(item => item.title.trim());
  const done = named.filter(item => status[item.id] === 'placed').length;

  // The URLs method can't write anything without a URL. Deciding that here
  // rather than inside each request turns N identical failures into one
  // disabled button that explains itself.
  const readyUrls = urls.filter(u => u.trim());
  const needsUrls = method === 'urls' && readyUrls.length === 0;

  const mark = (id: string, next: TopicStatus) => setStatus(prev => ({ ...prev, [id]: next }));

  /**
   * Fold the in-flight rename back in before any structural change. Indenting
   * mid-rename would otherwise re-render the row from the stored title and
   * throw away what had been typed.
   */
  const settled = (items: PlanItem[]) =>
    (editingId ? rename(items, editingId, editValue) : items);

  const commitEdit = () => {
    if (!editingId) return;
    setPlan(items => rename(items, editingId, editValue));
    setEditingId(null);
  };

  const startEdit = (item: PlanItem) => {
    setEditingId(item.id);
    setEditValue(item.title);
  };

  const editKeys = (item: PlanItem) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingId(null);
      return;
    }
    if (event.key === 'Tab') {
      // Tab is how every outliner changes depth, and there is nothing else on
      // this row to move focus to.
      event.preventDefault();
      setPlan(items => (event.shiftKey ? outdent(settled(items), item.id) : indent(settled(items), item.id)));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) { commitEdit(); return; }
      // Enter commits and opens the next sibling, so a whole outline can be
      // typed without reaching for the mouse.
      const { items, created } = addAfter(settled(plan), item.id);
      setPlan(items);
      setEditingId(created.id);
      setEditValue('');
      return;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      setPlan(items => move(settled(items), item.id, event.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    if (event.key === 'Backspace' && !editValue) {
      event.preventDefault();
      setPlan(items => remove(items, item.id));
      setEditingId(null);
    }
  };

  const loadOutline = async (from: 'subject' | 'draft') => {
    if (from === 'subject' && !subject.trim()) return;
    if (from === 'draft' && !content.trim()) {
      toast.info('Write something first — this outlines what you already have.');
      return;
    }
    setLoadingOutline(true);
    setPlan([]);
    try {
      const result = from === 'draft'
        ? await outlineDraft(content, format)
        : await fetchHierarchy(subject);
      setPlan(result);
      setStatus({});
      setEditingId(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to build an outline'));
    } finally {
      setLoadingOutline(false);
    }
  };

  const writeSection = async (item: PlanItem): Promise<boolean> => {
    if (!item.title.trim()) {
      toast.info('Give this section a name first.');
      return false;
    }
    setBusy(true);
    mark(item.id, 'generating');
    try {
      const text = await generateSection({
        format,
        method,
        topic: item.title,
        mainTopic: subject || projectName,
        outline: plan,
        urls: readyUrls,
      });
      // Already on the page means this is a rewrite, not a second copy.
      onInsertSection(text, item.title, status[item.id] === 'placed');
      mark(item.id, 'placed');
      return true;
    } catch (error) {
      // Mark it failed rather than clearing it: a row that looks untouched
      // gives no hint anything went wrong, and the spinner would hang forever.
      mark(item.id, 'failed');
      toast.error(errorMessage(error, `Could not write "${item.title}"`));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Write every section still outstanding, in outline order. Stops on the
   * first failure: continuing would fire one doomed request per section and
   * bury the user under identical error toasts (a bad key fails all of them).
   */
  const writeAll = async () => {
    const pending = named.filter(item => status[item.id] !== 'placed');
    if (!pending.length) {
      toast.info('Every section is already in the document');
      return;
    }
    stopRequested.current = false;
    setProgress({ done: 0, total: pending.length });

    let completed = 0;
    for (const item of pending) {
      if (stopRequested.current) break;
      if (!(await writeSection(item))) break;
      completed += 1;
      setProgress({ done: completed, total: pending.length });
    }

    setProgress(null);
    // Say how far it got. Ending early in silence reads as success until you
    // count the sections and come up short.
    if (completed < pending.length) {
      const why = stopRequested.current ? 'Stopped' : 'Stopped after an error';
      toast.info(`${why} — wrote ${completed} of ${pending.length}`);
    } else if (completed) {
      toast.success(`Wrote ${completed} ${completed === 1 ? 'section' : 'sections'}`);
    }
    stopRequested.current = false;
  };

  /** Drop the whole outline in as headings, so the document has its shape. */
  const draftOutline = () => {
    const text = planToDocument(settled(plan), format);
    if (!text.trim()) {
      toast.info('Add something to the outline first.');
      return;
    }
    onInsert(text, `Drafted ${named.length} ${named.length === 1 ? 'heading' : 'headings'}`);
  };

  const addSection = () => {
    const last = plan[plan.length - 1];
    if (!last) {
      const created = planItem('', 1);
      setPlan([created]);
      setEditingId(created.id);
      setEditValue('');
      return;
    }
    const { items, created } = addAfter(settled(plan), last.id);
    setPlan(items);
    setEditingId(created.id);
    setEditValue('');
  };

  return (
    <div className="ai-panel" data-open={open}>
      <div className="ai-panel-inner">
        <div className="ai-panel-head">
          <Sparkles className="h-4 w-4" style={{ color: 'var(--accent-500)' }} />
          <span className="ai-panel-title">Generate</span>
          <Chip tone={format === 'latex' ? 'latex' : 'accent'}>
            {format === 'latex' ? 'LaTeX' : 'MDX'}
          </Chip>
          <IconButton className="ml-auto" onClick={onClose} title="Close panel" aria-label="Close AI panel">
            <PanelLeftClose className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="ai-panel-body">
          <div className="ai-panel-section">
            <div className="flex gap-2">
              <Input
                placeholder="What is this document about?"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadOutline('subject'); }}
                className="flex-1 h-10 text-sm bg-[var(--ink-a02)] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] focus-visible:ring-1 focus-visible:ring-[var(--line-strong)]"
              />
              <button
                className="ai-run-btn"
                onClick={() => loadOutline('subject')}
                disabled={loadingOutline || !subject.trim()}
                title="Build an outline"
                aria-label="Build an outline"
              >
                {loadingOutline
                  ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-500)' }} />
                  : <Search className="h-4 w-4" style={{ color: 'var(--accent-500)' }} />}
              </button>
            </div>

            <button className="ai-secondary-btn" onClick={() => loadOutline('draft')} disabled={loadingOutline}>
              <ListTree className="h-3.5 w-3.5" />
              Outline what I've already written
            </button>

            <div className="ai-field-label">Where section content comes from</div>
            <div className="method-switch">
              {METHODS.map(m => (
                <button
                  key={m.key}
                  className="method-btn"
                  data-active={method === m.key}
                  onClick={() => setMethod(m.key)}
                  title={m.hint}
                >
                  <m.icon className="h-3.5 w-3.5" />{m.label}
                </button>
              ))}
            </div>

            {method === 'urls' && (
              <div className="space-y-1.5">
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      placeholder="https://…"
                      value={url}
                      className="flex-1 h-7 text-[11px] bg-[var(--ink-a02)] border-[var(--line-soft)] text-[var(--ink)]"
                      onChange={e => { const next = [...urls]; next[i] = e.target.value; setUrls(next); }}
                    />
                    {urls.length > 1 && (
                      <IconButton tone="danger" onClick={() => setUrls(urls.filter((_, j) => j !== i))} aria-label="Remove URL">
                        <X className="h-3 w-3" />
                      </IconButton>
                    )}
                  </div>
                ))}
                {urls.length < 4 && (
                  <button className="ai-add-url" onClick={() => setUrls([...urls, ''])}>
                    <Plus className="h-2.5 w-2.5" /> Add URL
                  </button>
                )}
                {needsUrls && (
                  <p className="ai-field-note">Add a URL to write sections from these pages.</p>
                )}
              </div>
            )}
          </div>

          {loadingOutline && (
            <div className="ai-panel-loading">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-500)' }} />
              Building the outline…
            </div>
          )}

          {plan.length > 0 && (
            <div className="ai-panel-section">
              <div className="ai-section-head">
                <span>Outline <span className="topic-count">{done}/{named.length}</span></span>
                {progress ? (
                  <button
                    className="ai-inline-btn"
                    onClick={() => { stopRequested.current = true; }}
                    title="Finish the section in flight, then stop"
                  >
                    Stop · {progress.done}/{progress.total}
                  </button>
                ) : (
                  <button
                    className="ai-inline-btn"
                    onClick={writeAll}
                    disabled={busy || needsUrls || !named.length}
                    title={needsUrls ? 'Add a URL first' : 'Write every remaining section into the document'}
                  >
                    Generate all
                  </button>
                )}
              </div>

              <button
                className="ai-primary-btn"
                onClick={draftOutline}
                disabled={!named.length}
                title="Put every outline item into the document as a heading"
              >
                <ListTree className="h-3.5 w-3.5" />
                Draft outline into document
              </button>

              {progress && (
                <div className="gen-progress">
                  <div className="gen-progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              )}

              <div className="plan-list">
                {plan.map(item => (
                  <PlanRow
                    key={item.id}
                    item={item}
                    status={status[item.id]}
                    busy={busy || needsUrls}
                    editing={editingId === item.id}
                    value={editValue}
                    onValue={setEditValue}
                    onEdit={() => startEdit(item)}
                    onCommit={commitEdit}
                    onKeyDown={editKeys(item)}
                    onGenerate={() => writeSection(item)}
                    onIndent={() => setPlan(items => indent(settled(items), item.id))}
                    onOutdent={() => setPlan(items => outdent(settled(items), item.id))}
                    onUp={() => setPlan(items => move(settled(items), item.id, -1))}
                    onDown={() => setPlan(items => move(settled(items), item.id, 1))}
                    onDelete={() => {
                      setPlan(items => remove(settled(items), item.id));
                      if (editingId === item.id) setEditingId(null);
                    }}
                  />
                ))}
              </div>

              <button className="ai-add-url" onClick={addSection}>
                <Plus className="h-2.5 w-2.5" /> Add section
              </button>

              <p className="ai-hint">
                Click a section to write it in. Double-click to rename; <kbd>Tab</kbd> and
                {' '}<kbd>⇧Tab</kbd> change its depth.
              </p>
            </div>
          )}

          {!loadingOutline && !plan.length && (
            <div className="ai-panel-empty">
              <Sparkles className="h-8 w-8" />
              <p>Name a subject to get an outline, shape it, then write each section.</p>
              <p className="ai-panel-empty-sub">
                Select text in the page and press <kbd>⌘J</kbd> to edit it with AI instead.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
