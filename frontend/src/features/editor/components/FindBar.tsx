import { useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, CaseSensitive, X, Replace } from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import type { FindReplace } from '../hooks/useFindReplace';

/** Find and replace, opened with ⌘F and closed with Escape. */
export function FindBar({ find }: { find: FindReplace }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (find.open) inputRef.current?.select();
  }, [find.open]);

  if (!find.open) return null;

  return (
    <div className="find-bar" role="search">
      <input
        ref={inputRef}
        className="find-input"
        placeholder="Find in document"
        value={find.query}
        onChange={e => find.setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); find.step(e.shiftKey ? -1 : 1); }
          if (e.key === 'Escape') find.setOpen(false);
        }}
        aria-label="Find"
      />
      <span className="find-count">
        {find.query ? (find.matches.length ? `${find.current + 1}/${find.matches.length}` : 'none') : ''}
      </span>
      <IconButton onClick={() => find.step(-1)} title="Previous match" aria-label="Previous match">
        <ChevronUp className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton onClick={() => find.step(1)} title="Next match" aria-label="Next match">
        <ChevronDown className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        data-active={find.caseSensitive}
        onClick={() => find.setCaseSensitive(!find.caseSensitive)}
        title="Match case"
        aria-label="Match case"
      >
        <CaseSensitive className="h-3.5 w-3.5" />
      </IconButton>

      <div className="find-divider" />

      <input
        className="find-input"
        placeholder="Replace with"
        value={find.replacement}
        onChange={e => find.setReplacement(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); find.replaceCurrent(); }
          if (e.key === 'Escape') find.setOpen(false);
        }}
        aria-label="Replace with"
      />
      <button className="find-btn" onClick={find.replaceCurrent} disabled={!find.matches.length}>
        <Replace className="h-3 w-3" /> Replace
      </button>
      <button className="find-btn" onClick={find.replaceAll} disabled={!find.matches.length}>
        All
      </button>

      <IconButton onClick={() => find.setOpen(false)} title="Close" aria-label="Close find">
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
