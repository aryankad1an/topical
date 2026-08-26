import { useEffect, useRef, useState } from 'react';
import { Cpu, Globe, Link2, Plus, Sparkles, X } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import type { GenerationMethod } from '../lib/generation';

const METHODS: { key: GenerationMethod; icon: typeof Globe; label: string; hint: string }[] = [
  { key: 'web', icon: Globe, label: 'Web', hint: 'Search the web for this section first' },
  { key: 'llm', icon: Cpu, label: 'Model', hint: "Use the model's own knowledge only" },
  { key: 'urls', icon: Link2, label: 'URLs', hint: 'Ground it in pages you name' },
];

/** More than a handful of sources stops being a choice and starts being a list. */
const MAX_URLS = 4;

/**
 * Openers, so the common asks cost a click rather than a sentence.
 *
 * The chip is short and the instruction it writes is not. Printed in full they
 * were each wider than the rail, so five chips wrapped to five rows and the
 * popover was mostly a list of sentences — which is the thing the field below
 * is for.
 */
const ASKS: { label: string; text: string }[] = [
  { label: 'Keep it brief', text: 'Keep it under 250 words.' },
  { label: 'Worked example', text: 'Lead with a fully worked example before the general case.' },
  { label: 'Go deeper', text: 'Go deeper — include the derivations and the edge cases.' },
  { label: 'Plain language', text: 'Plain language. Define any term a newcomer would not know.' },
  { label: 'Add a table', text: 'Include a comparison table.' },
];

export interface WriteRequest {
  instruction: string;
  method: GenerationMethod;
  urls: string[];
}

interface Props {
  /** What is about to be written — one section's title, or a count. */
  target: string;
  /** True when this is the bulk button rather than a single row. */
  bulk?: boolean;
  /** Whether the target already has prose, so the verb can be honest. */
  rewriting?: boolean;
  method: GenerationMethod;
  onMethod: (method: GenerationMethod) => void;
  urls: string[];
  onUrls: (urls: string[]) => void;
  onWrite: (request: WriteRequest) => void;
  onClose: () => void;
}

/**
 * Asked before anything is written: how, and from what.
 *
 * The ✨ on a row used to fire a request immediately, with the source taken
 * from a three-way switch pinned to the bottom of the rail — a control that
 * looked like it described the outline, sat a long way from every button it
 * governed, and had to be set *before* you knew which section you were about
 * to write. There was nowhere at all to say "keep this one short".
 *
 * One popover now carries both, at the moment of asking, next to the thing it
 * applies to. Enter submits, so the fast path is still one keystroke.
 */
export function WritePopover({
  target, bulk, rewriting, method, onMethod, urls, onUrls, onWrite, onClose,
}: Props) {
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const needsUrls = method === 'urls' && !urls.some(u => u.trim());

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (needsUrls) return;
    onWrite({ instruction: instruction.trim(), method, urls });
  };

  return (
    <form className="write-pop" onSubmit={submit} onClick={e => e.stopPropagation()}>
      <div className="write-pop-head">
        <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent-400)' }} />
        <span className="write-pop-title">
          {rewriting ? 'Rewrite' : 'Write'} <b>{target}</b>
        </span>
        <IconButton className="ml-auto" onClick={onClose} aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="write-pop-body">
        <label className="write-pop-label" htmlFor="write-instruction">
          How should it be written? <span className="write-pop-optional">optional</span>
        </label>
        <textarea
          id="write-instruction"
          ref={inputRef}
          className="write-pop-input"
          rows={2}
          value={instruction}
          placeholder={bulk
            ? 'Applies to every section in this run — e.g. keep each one under 300 words'
            : 'e.g. focus on the time complexity, with a worked example'}
          onChange={e => setInstruction(e.target.value)}
          /* Enter submits because this is a one-line answer nine times out of
             ten; Shift-Enter is there for the tenth. */
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />

        <div className="write-pop-asks">
          {ASKS.map(ask => (
            <button
              key={ask.label}
              type="button"
              className="write-pop-ask"
              title={ask.text}
              onClick={() => { setInstruction(ask.text); inputRef.current?.focus(); }}
            >
              {ask.label}
            </button>
          ))}
        </div>

        <div className="write-pop-divider" />

        <span className="write-pop-label">Where the material comes from</span>
        <div className="method-switch">
          {METHODS.map(m => (
            <button key={m.key} type="button" className="method-btn" data-active={method === m.key}
              onClick={() => onMethod(m.key)} title={m.hint}>
              <m.icon className="h-3 w-3" />{m.label}
            </button>
          ))}
        </div>
        <p className="write-pop-method-hint">{METHODS.find(m => m.key === method)?.hint}</p>

        {method === 'urls' && (
          <div className="orail-urls">
            {urls.map((url, i) => (
              <div key={i} className="flex gap-1">
                <input
                  className="orail-input" placeholder="https://…" value={url}
                  onChange={e => onUrls(urls.map((u, j) => (j === i ? e.target.value : u)))}
                />
                {urls.length > 1 && (
                  <IconButton tone="danger" onClick={() => onUrls(urls.filter((_, j) => j !== i))} aria-label="Remove URL">
                    <X className="h-3 w-3" />
                  </IconButton>
                )}
              </div>
            ))}
            {urls.length < MAX_URLS && (
              <button type="button" className="orail-link" onClick={() => onUrls([...urls, ''])}>
                <Plus className="h-2.5 w-2.5" /> Add URL
              </button>
            )}
          </div>
        )}

        <button type="submit" className="orail-primary write-pop-go" disabled={needsUrls}>
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {needsUrls ? 'Add a URL first' : rewriting ? `Rewrite ${target}` : `Write ${target}`}
        </button>
      </div>
    </form>
  );
}
