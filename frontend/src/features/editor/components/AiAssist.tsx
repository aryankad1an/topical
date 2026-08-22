import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Sparkles, X, RotateCcw, Check, CornerDownLeft, Copy, ArrowLeft } from 'lucide-react';
import { transformSelection } from '@/lib/api';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import { IconButton } from '@/components/ui/primitives';
import { AI_ACTIONS, CONTEXT_CHARS, MIN_PASSAGE_WORDS, type AiAction } from '../lib/aiActions';
import { countWords } from '../lib/stats';
import { copyText } from '../lib/exporters';

interface Props {
  anchor: { x: number; y: number } | null;
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
  const instructionRef = useRef<HTMLInputElement>(null);

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
  }, [phase]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  const offered = AI_ACTIONS.filter(a => hasSelection || a.worksOnCaret);

  return (
    <div className="ai-assist" style={{ left: anchor.x, top: anchor.y }} role="dialog" aria-label="AI edit">
      <div className="ai-assist-head">
        <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-400)' }} />
        <span>
          {phase === 'result' && action ? action.label
            : hasSelection ? `${words} ${words === 1 ? 'word' : 'words'} selected`
              : 'At the cursor'}
        </span>
        <IconButton className="ml-auto" onClick={onClose} aria-label="Close"><X className="h-3.5 w-3.5" /></IconButton>
      </div>

      {phase === 'menu' && (
        <div className="ai-assist-list">
          {offered.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className="ai-assist-item"
                onClick={() => (item.id === 'custom' ? setPhase('custom') : run(item))}
              >
                <Icon className="h-3.5 w-3.5 ai-assist-icon" />
                <span className="ai-assist-label">{item.label}</span>
                <span className="ai-assist-hint">{item.hint}</span>
              </button>
            );
          })}
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
