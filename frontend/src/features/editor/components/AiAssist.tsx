import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, X, RotateCcw, Check, CornerDownLeft, Copy, ArrowLeft } from 'lucide-react';
import { transformSelection } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import { IconButton } from '@/components/ui/primitives';
import { AI_ACTIONS, CONTEXT_CHARS, MIN_PASSAGE_WORDS, type AiAction } from '../lib/aiActions';
import { countWords } from '../lib/stats';
import { copyText } from '../lib/exporters';

/** The anchor line, in the editing surface's own coordinates. */
export interface AssistAnchor {
  x: number;
  lineTop: number;
  lineBottom: number;
  boxWidth: number;
  boxHeight: number;
}

interface Props {
  anchor: AssistAnchor | null;
  selection: { start: number; end: number };
  content: string;
  format: DocFormat;
  title: string;
  onReplace: (text: string) => void;
  onInsertAfter: (text: string) => void;
  onClose: () => void;
}

type Phase = 'menu' | 'custom' | 'running' | 'result';

/**
 * Inline AI on whatever is selected.
 *
 * The generation panel writes whole sections from a topic; this is the other
 * half — working on the words already on the page. Nothing is applied until
 * the result has been read, so the model can't quietly overwrite a paragraph.
 */
export function AiAssist({
  anchor, selection, content, format, title, onReplace, onInsertAfter, onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>('menu');
  const [action, setAction] = useState<AiAction | null>(null);
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState('');
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const instructionRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Placed after measuring, so `null` means "not positioned yet". */
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  const passage = content.slice(selection.start, selection.end);
  const hasSelection = passage.trim().length > 0;
  // The same counter the status bar uses, so the two never disagree — it reads
  // through the markup rather than counting `**bold**` and `\section{}` as words.
  const words = countWords(passage, format);
  // Text leading up to the selection: context for a rewrite, and the passage
  // itself when there is nothing selected to continue from.
  const runUp = content.slice(Math.max(0, selection.start - CONTEXT_CHARS), selection.start);

  useEffect(() => {
    if (phase === 'custom') instructionRef.current?.focus();
    if (phase === 'menu') filterRef.current?.focus();
  }, [phase]);

  const offered = useMemo(
    () => AI_ACTIONS.filter(a => hasSelection || a.worksOnCaret),
    [hasSelection],
  );

  /**
   * Type to narrow. Twelve actions is past the number anyone scans, and this
   * panel is opened from the keyboard — reaching for the mouse to pick from a
   * list you summoned with ⌘J is the wrong shape for the interaction.
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offered;
    return offered.filter(a => (a.label + ' ' + a.hint).toLowerCase().includes(q));
  }, [offered, query]);

  useEffect(() => { setCursor(0); }, [query]);

  /**
   * Above the line or below it, whichever fits — measured, not assumed.
   *
   * `useLayoutEffect` so the position is written before the browser paints:
   * with `useEffect` the panel is visible for a frame at the top-left of the
   * surface and then jumps, which reads as a glitch on something opened
   * dozens of times an hour.
   */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !anchor) return;
    const { height, width } = panel.getBoundingClientRect();
    const GAP = 8;
    const below = anchor.lineBottom + GAP;
    const above = anchor.lineTop - height - GAP;
    // Prefer below — it does not cover the line you are working on. Flip only
    // when there is genuinely no room, and if neither fits, take whichever
    // side has more and clamp.
    const roomBelow = anchor.boxHeight - below;
    const top = roomBelow >= height ? below : above >= 0 ? above : Math.max(GAP, anchor.boxHeight - height - GAP);
    setPlace({
      left: Math.max(GAP, Math.min(anchor.x, anchor.boxWidth - width - GAP)),
      top,
    });
  }, [anchor, phase, results.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep the highlighted row in view when it is driven from the keyboard.
  useEffect(() => {
    listRef.current?.querySelector('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!anchor) return null;

  const run = async (chosen: AiAction, customInstruction = '') => {
    if (chosen.needsPassage && words < MIN_PASSAGE_WORDS) {
      toast.info(`"${chosen.label}" needs something to work with — select at least ${MIN_PASSAGE_WORDS} words.`);
      return;
    }
    setAction(chosen);
    setPhase('running');
    try {
      const text = await transformSelection({
        action: chosen.id,
        // "Continue writing" has nothing selected: the run-up becomes the
        // passage. Sending it as `before` as well would put the identical text
        // in the prompt twice, once labelled "do not rewrite it".
        selection: hasSelection ? passage : runUp,
        format,
        instruction: customInstruction,
        before: hasSelection ? runUp : '',
        after: content.slice(selection.end, selection.end + CONTEXT_CHARS),
        title,
      });
      if (!text.trim()) throw new Error('The model returned nothing. Try again.');
      setResult(text.trim());
      setPhase('result');
    } catch (error) {
      toast.error(errorMessage(error, 'The AI edit failed'));
      setPhase('menu');
    }
  };

  const choose = (item: AiAction) => (item.id === 'custom' ? setPhase('custom') : run(item));

  return (
    <div
      ref={panelRef}
      className="ai-assist"
      data-phase={phase}
      /* Hidden until measured, so it is never seen at the wrong place. */
      style={place ? { left: place.left, top: place.top } : { left: 0, top: 0, visibility: 'hidden' }}
      role="dialog"
      aria-label="AI edit"
    >
      {/* ── The menu is a command bar, not a titled dialog ──
          What was here was a header row (icon, "123 words selected", a close
          button) above twelve rows that each carried a label *and* a hint in
          a second column — a 340px panel about 300px tall, dropped on top of
          the paragraph being edited, with the hints truncated to "Clearer and
          more precise, sa…" and so telling nobody anything.

          The word count moves into the filter's placeholder, where it is
          still answering "what am I about to act on" without spending a row.
          The hint survives only on the row under the cursor, which is the
          only row it can be read on anyway. */}
      {phase === 'menu' && (
        <>
          <div className="ai-assist-search">
            <Sparkles className="h-3.5 w-3.5 ai-assist-spark" />
            <input
              ref={filterRef}
              className="ai-assist-filter"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={hasSelection
                ? `${words} ${words === 1 ? 'word' : 'words'} — what should happen?`
                : 'At the cursor — what should happen?'}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
                else if (e.key === 'Enter') {
                  e.preventDefault();
                  const item = results[cursor];
                  // Typing something no action matches is itself an
                  // instruction — Enter runs it as one rather than doing
                  // nothing, which is the only useful reading of that state.
                  if (item) choose(item);
                  else if (query.trim()) { setInstruction(query.trim()); run(AI_ACTIONS.find(a => a.id === 'custom')!, query.trim()); }
                }
              }}
            />
          </div>

          <div className="ai-assist-list" ref={listRef} role="listbox">
            {results.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  role="option"
                  aria-selected={i === cursor}
                  data-cursor={i === cursor}
                  className="ai-assist-item"
                  onMouseMove={() => setCursor(i)}
                  onClick={() => choose(item)}
                >
                  <Icon className="h-3.5 w-3.5 ai-assist-icon" />
                  <span className="ai-assist-label">{item.label}</span>
                  {i === cursor && <span className="ai-assist-hint">{item.hint}</span>}
                </button>
              );
            })}
            {!results.length && (
              <p className="ai-assist-empty">
                Press <kbd>↵</kbd> to run “{query.trim()}” as an instruction
              </p>
            )}
          </div>
        </>
      )}

      {phase !== 'menu' && (
        <div className="ai-assist-head">
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-400)' }} />
          <span>{action ? action.label : 'Custom instruction'}</span>
          <IconButton className="ml-auto" onClick={onClose} aria-label="Close"><X className="h-3.5 w-3.5" /></IconButton>
        </div>
      )}

      {phase === 'custom' && (
        <form
          className="ai-assist-custom"
          onSubmit={event => {
            event.preventDefault();
            if (!instruction.trim()) return;
            run(AI_ACTIONS.find(a => a.id === 'custom')!, instruction);
          }}
        >
          <input
            ref={instructionRef}
            className="ai-assist-input"
            placeholder="e.g. rewrite this as a worked example with numbers"
            value={instruction}
            onChange={event => setInstruction(event.target.value)}
          />
          <div className="ai-assist-actions">
            <button type="button" className="ai-btn" onClick={() => setPhase('menu')}>
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <button type="submit" className="ai-btn ai-btn--primary" disabled={!instruction.trim()}>
              <CornerDownLeft className="h-3 w-3" /> Run
            </button>
          </div>
        </form>
      )}

      {phase === 'running' && (
        <div className="ai-assist-running">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--accent-400)' }} />
          <span>{action?.label}…</span>
        </div>
      )}

      {phase === 'result' && action && (
        <div className="ai-assist-result">
          <pre className="ai-assist-preview">{result}</pre>
          <div className="ai-assist-actions">
            {/* A rewrite belongs back in the document; an explanation is
                something you read, so pushing it into the page is the wrong
                thing to highlight. */}
            {action.replaces && hasSelection && (
              <button className="ai-btn ai-btn--primary" onClick={() => { onReplace(result); onClose(); }}>
                <Check className="h-3 w-3" /> Replace
              </button>
            )}
            <button
              className={`ai-btn${action.replaces && !hasSelection ? ' ai-btn--primary' : ''}`}
              onClick={() => { onInsertAfter(result); onClose(); }}
            >
              <CornerDownLeft className="h-3 w-3" /> Insert below
            </button>
            <button
              className={`ai-btn${action.replaces ? '' : ' ai-btn--primary'}`}
              onClick={() => copyText(result).then(() => toast.success('Copied'))}
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button className="ai-btn" onClick={() => run(action, instruction)}>
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
