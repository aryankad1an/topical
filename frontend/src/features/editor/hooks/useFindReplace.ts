import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Range } from '../lib/textOps';

interface Options {
  content: string;
  onReplace: (next: string, caret: number) => void;
  onFocusMatch: (match: Range) => void;
}

export interface FindReplace {
  open: boolean;
  setOpen: (open: boolean) => void;
  query: string;
  setQuery: (q: string) => void;
  replacement: string;
  setReplacement: (r: string) => void;
  caseSensitive: boolean;
  setCaseSensitive: (v: boolean) => void;
  matches: Range[];
  current: number;
  step: (direction: 1 | -1) => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
}

/** Find and replace over the raw document text. */
export function useFindReplace({ content, onReplace, onFocusMatch }: Options): FindReplace {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [current, setCurrent] = useState(0);

  const matches = useMemo(() => {
    if (!open || query.length === 0) return [];
    const found: Range[] = [];
    const haystack = caseSensitive ? content : content.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    let at = haystack.indexOf(needle);
    while (at !== -1 && found.length < 2000) {
      found.push({ start: at, end: at + needle.length });
      at = haystack.indexOf(needle, at + Math.max(needle.length, 1));
    }
    return found;
  }, [caseSensitive, content, open, query]);

  // Keep the cursor inside the result set as the query narrows it.
  useEffect(() => {
    setCurrent(c => (matches.length ? Math.min(c, matches.length - 1) : 0));
  }, [matches.length]);

  const step = useCallback((direction: 1 | -1) => {
    if (!matches.length) return;
    const next = (current + direction + matches.length) % matches.length;
    setCurrent(next);
    onFocusMatch(matches[next]);
  }, [current, matches, onFocusMatch]);

  const replaceCurrent = useCallback(() => {
    const match = matches[current];
    if (!match) return;
    const next = content.slice(0, match.start) + replacement + content.slice(match.end);
    onReplace(next, match.start + replacement.length);
  }, [content, current, matches, onReplace, replacement]);

  const replaceAll = useCallback(() => {
    if (!matches.length) return;
    let next = '';
    let cursor = 0;
    for (const match of matches) {
      next += content.slice(cursor, match.start) + replacement;
      cursor = match.end;
    }
    next += content.slice(cursor);
    onReplace(next, next.length);
  }, [content, matches, onReplace, replacement]);

  return {
    open, setOpen, query, setQuery, replacement, setReplacement,
    caseSensitive, setCaseSensitive, matches, current, step, replaceCurrent, replaceAll,
  };
}
