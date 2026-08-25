import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileType2, FileCode2, Loader2 } from 'lucide-react';
import type { DocFormat } from '@/lib/types';

/**
 * The front door of the workspace: a topic, and the format to write it in.
 *
 * What this replaces was three controls for one intention — two "Blank
 * document" tiles that opened a dialog that asked for a name, and the name
 * was the only thing either tile actually collected. A document here is
 * *about* something before it is called anything, so the field asks for the
 * subject and the format sits inside the same control rather than being a
 * separate decision made before you have typed anything.
 *
 * It is deliberately the same object as the landing page's hero field. A
 * visitor who typed a topic there and signed up arrives to the identical
 * control, already holding what they typed — see `topical_pending_topic`.
 */
export function TopicStarter({
  onStart,
  busy,
}: {
  onStart: (topic: string, format: DocFormat) => void;
  busy?: boolean;
}) {
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState<DocFormat>('mdx');
  const inputRef = useRef<HTMLInputElement>(null);

  // Whatever they typed on the landing page. Read once and cleared, so a
  // topic they abandoned does not reappear on every later visit.
  useEffect(() => {
    try {
      const pending = localStorage.getItem('topical_pending_topic');
      if (pending) {
        localStorage.removeItem('topical_pending_topic');
        setTopic(pending);
        inputRef.current?.focus();
      }
    } catch {
      // Private mode blocks both calls. There is nothing to recover.
    }
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = topic.trim();
    if (!value || busy) return;
    onStart(value, format);
  };

  return (
    <form className="topic-bar topic-bar--workspace" onSubmit={submit}>
      <label className="sr-only" htmlFor="workspace-topic">Topic</label>
      <input
        id="workspace-topic"
        ref={inputRef}
        className="topic-input"
        placeholder="What's the topic?"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        disabled={busy}
      />

      {/* Format lives inside the bar because it qualifies the topic rather
          than being a step before it. Two options, both always visible: a
          select would hide half the answer behind a click. */}
      <div className="topic-format segmented" role="group" aria-label="Format">
        <button type="button" data-active={format === 'mdx'} onClick={() => setFormat('mdx')} title="MDX — interactive document">
          <FileType2 className="h-3.5 w-3.5" /> MDX
        </button>
        <button type="button" data-active={format === 'latex'} onClick={() => setFormat('latex')} title="LaTeX — typeset for academic work">
          <FileCode2 className="h-3.5 w-3.5" /> LaTeX
        </button>
      </div>

      <button type="submit" className="accent-btn topic-go" disabled={busy || !topic.trim()}>
        {busy
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <><span className="topic-go-label">Start</span><ArrowRight className="h-4 w-4" /></>}
      </button>
    </form>
  );
}
