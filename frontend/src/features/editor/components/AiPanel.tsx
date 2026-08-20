import { useState } from 'react';
import { toast } from 'sonner';
import {
  Check, Cpu, Dot, Globe, GripVertical, Link2, ListTree, Loader2,
  PanelLeftClose, Plus, Search, Sparkles, X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Chip, IconButton } from '@/components/ui/primitives';
import { errorMessage } from '@/lib/utils';
import type { DocFormat, TopicHierarchy } from '@/lib/types';
import { fetchHierarchy, generateSection, outlineDraft, type GenerationMethod } from '../lib/generation';

interface Props {
  open: boolean;
  onClose: () => void;
  format: DocFormat;
  projectName: string;
  /** Current document — used when outlining an existing draft. */
  content: string;
  /** Place text at the caret. */
  onInsert: (text: string, label: string) => void;
}

interface Draft {
  id: string;
  topic: string;
  content: string;
}

type TopicStatus = 'generating' | 'drafted' | 'placed';

const METHODS: { key: GenerationMethod; icon: typeof Globe; label: string; hint: string }[] = [
  { key: 'crawl', icon: Globe, label: 'Web', hint: 'Research the topic online first' },
  { key: 'llm', icon: Cpu, label: 'Model', hint: "Use the model's own knowledge" },
  { key: 'urls', icon: Link2, label: 'URLs', hint: 'Ground it in pages you choose' },
];

/** One outline row, showing how far that topic has progressed. */
function TopicRow({ label, status, busy, sub, onClick }: {
  label: string;
  status?: TopicStatus;
  busy: boolean;
  sub?: boolean;
  onClick: () => void;
}) {
  const title = status === 'placed'
    ? `"${label}" is in your document — click to draft it again`
    : status === 'drafted'
      ? `Draft ready for "${label}" — insert it from Drafts above`
      : `Generate content for "${label}"`;

  return (
    <button
      className={`topic-row${sub ? ' topic-row--sub' : ''}`}
      data-status={status ?? 'idle'}
      disabled={busy}
      onClick={onClick}
      title={title}
    >
      <span className="topic-mark">
        {status === 'generating' ? <Loader2 className="h-2.5 w-2.5 animate-spin" style={{ color: 'var(--accent-400)' }} />
          : status === 'placed' ? <Check className="h-2.5 w-2.5" />
            : status === 'drafted' ? <Dot className="h-3 w-3" /> : null}
      </span>
      <span className="topic-name">{label}</span>
    </button>
  );
}

/**
 * Long-form generation: turn a subject into an outline, then work through it
 * section by section, keeping each result as a draft until it is placed.
 */
export function AiPanel({ open, onClose, format, projectName, content, onInsert }: Props) {
  const [subject, setSubject] = useState('');
  const [method, setMethod] = useState<GenerationMethod>('crawl');
  const [urls, setUrls] = useState(['']);
  const [hierarchy, setHierarchy] = useState<TopicHierarchy[]>([]);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Record<string, TopicStatus>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const topics = hierarchy.flatMap(h => [h.topic, ...h.subtopics]);
  const done = topics.filter(t => status[t] === 'drafted' || status[t] === 'placed').length;

  const mark = (topic: string, next: TopicStatus) => setStatus(prev => ({ ...prev, [topic]: next }));

  const loadOutline = async (from: 'subject' | 'draft') => {
    if (from === 'subject' && !subject.trim()) return;
    if (from === 'draft' && !content.trim()) {
      toast.info('Write something first — this outlines what you already have.');
      return;
    }
    setLoadingOutline(true);
    setHierarchy([]);
    try {
      const result = from === 'draft'
        ? await outlineDraft(content, format)
        : await fetchHierarchy(subject);
      setHierarchy(result);
      setStatus({});
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to build an outline'));
    } finally {
      setLoadingOutline(false);
    }
  };

  const draftTopic = async (topic: string): Promise<boolean> => {
    setBusy(true);
    mark(topic, 'generating');
    try {
      const text = await generateSection({
        format,
        method,
        topic,
        mainTopic: subject || projectName,
        hierarchy,
        urls: urls.filter(u => u.trim()),
      });
      const draft = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, topic, content: text };
      setDrafts(prev => [draft, ...prev]);
      setExpanded(draft.id);
      mark(topic, 'drafted');
      toast.success(`Drafted "${topic}" — drag it in, or click Insert`);
      return true;
    } catch (error) {
      // Clear the row so a failed topic can be retried rather than being
      // stuck showing a spinner.
      setStatus(prev => {
        const next = { ...prev };
        delete next[topic];
        return next;
      });
      toast.error(errorMessage(error, `Could not generate "${topic}"`));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Draft everything still outstanding, in order. Stops on the first failure:
   * continuing would fire one doomed request per topic and bury the user under
   * identical error toasts (a bad key fails all of them).
   */
  const draftAll = async () => {
    const pending = topics.filter(t => !status[t]);
    if (!pending.length) {
      toast.info('Every topic already has a draft');
      return;
    }
    setProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      if (!(await draftTopic(pending[i]))) break;
      setProgress({ done: i + 1, total: pending.length });
    }
    setProgress(null);
  };

  const insertDraft = (draft: Draft) => {
    onInsert(draft.content, `Inserted "${draft.topic}"`);
    mark(draft.topic, 'placed');
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
                className="flex-1 h-10 text-sm bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20"
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
                      className="flex-1 h-7 text-[11px] bg-white/[0.02] border-white/[0.05] text-white"
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
              </div>
            )}
          </div>

          {drafts.length > 0 && (
            <div className="ai-panel-section">
              <div className="ai-section-head">
                <span>Drafts ({drafts.length})</span>
                <button
                  className="ai-inline-btn"
                  onClick={() => onInsert(drafts.map(d => d.content).join('\n\n'), `Inserted ${drafts.length} drafts`)}
                >
                  Insert all
                </button>
              </div>

              <div className="space-y-2">
                {drafts.map(draft => (
                  <div
                    key={draft.id}
                    className="draft-card"
                    draggable
                    onDragStart={event => {
                      event.dataTransfer.setData('text/plain', draft.content);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <div className="draft-row">
                      <GripVertical className="h-4 w-4 draft-grip" />
                      <button className="draft-title" onClick={() => setExpanded(expanded === draft.id ? null : draft.id)}>
                        <span>{draft.topic}</span>
                        <span className="draft-meta">{draft.content.length.toLocaleString()} characters · drag into the page</span>
                      </button>
                      <button className="draft-action" onClick={() => insertDraft(draft)}>Insert</button>
                      <IconButton
                        tone="danger"
                        onClick={() => setDrafts(prev => prev.filter(d => d.id !== draft.id))}
                        aria-label="Discard draft"
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                    {expanded === draft.id && (
                      <pre className="draft-preview">{draft.content.slice(0, 600)}{draft.content.length > 600 ? '…' : ''}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingOutline && (
            <div className="ai-panel-loading">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-500)' }} />
              Building the outline…
            </div>
          )}

          {hierarchy.length > 0 && (
            <div className="ai-panel-section">
              <div className="ai-section-head">
                <span>Outline <span className="topic-count">{done}/{topics.length}</span></span>
                <button className="ai-inline-btn" onClick={draftAll} disabled={busy}>
                  {progress ? `${progress.done}/${progress.total}…` : 'Draft all'}
                </button>
              </div>

              {progress && (
                <div className="gen-progress">
                  <div className="gen-progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              )}

              <div className="space-y-0.5 mt-1">
                {hierarchy.map((item, i) => (
                  <div key={i}>
                    <TopicRow label={item.topic} status={status[item.topic]} busy={busy} onClick={() => draftTopic(item.topic)} />
                    {item.subtopics.map((sub, j) => (
                      <TopicRow key={j} sub label={sub} status={status[sub]} busy={busy} onClick={() => draftTopic(sub)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loadingOutline && !hierarchy.length && !drafts.length && (
            <div className="ai-panel-empty">
              <Sparkles className="h-8 w-8" />
              <p>Name a subject to get an outline, then draft each section.</p>
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
