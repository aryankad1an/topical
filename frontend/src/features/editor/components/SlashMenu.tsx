import { useEffect, useMemo, useState } from 'react';
import type { DocFormat } from '@/lib/types';
import { actionsFor, type EditorAction } from '../lib/actions';

interface Props {
  format: DocFormat;
  query: string;
  /** Where to draw the menu — the caret's line, in viewport coordinates. */
  /* Shares the editor's line anchor with the AI panel. The slash menu is
     small and always follows the caret down the page, so it takes the simple
     reading of it — below the line, clamped inside the surface. */
  anchor: {
    x: number; lineTop: number; lineBottom: number; boxWidth: number; boxHeight: number;
  } | null;
  onPick: (action: EditorAction) => void;
  onClose: () => void;
}

/**
 * Type `/` and get every construct the format has, filtered as you keep
 * typing — the fastest path to a table or an aligned equation without
 * remembering its syntax.
 */
export function SlashMenu({ format, query, anchor, onPick, onClose }: Props) {
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = actionsFor(format);
    if (!q) return all;
    return all.filter(a =>
      a.label.toLowerCase().includes(q) ||
      a.group.toLowerCase().includes(q) ||
      a.terms?.includes(q));
  }, [format, query]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor(c => (results.length ? (c + 1) % results.length : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor(c => (results.length ? (c - 1 + results.length) % results.length : 0));
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        if (!results[cursor]) return;
        event.preventDefault();
        onPick(results[cursor]);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    // Capture: the textarea's own keydown handler would otherwise indent on Tab.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [cursor, onClose, onPick, results]);

  if (!anchor) return null;

  let lastGroup = '';

  return (
    <div
      className="slash-menu"
      style={{
        left: Math.max(8, Math.min(anchor.x, anchor.boxWidth - 328)),
        top: Math.max(8, Math.min(anchor.lineBottom + 8, anchor.boxHeight - 80)),
      }}
      role="listbox"
    >
      {results.length === 0 ? (
        <div className="slash-empty">Nothing matches “{query}”</div>
      ) : (
        results.map((action, index) => {
          const header = action.group !== lastGroup ? action.group : null;
          lastGroup = action.group;
          const Icon = action.icon;
          return (
            <div key={action.id}>
              {header && <div className="slash-group">{header}</div>}
              <button
                className="slash-item"
                data-active={index === cursor}
                onMouseEnter={() => setCursor(index)}
                onMouseDown={event => { event.preventDefault(); onPick(action); }}
                role="option"
                aria-selected={index === cursor}
              >
                <Icon className="h-3.5 w-3.5 slash-icon" />
                <span>{action.label}</span>
                {action.key && <kbd className="slash-kbd">⌘{action.key.toUpperCase()}</kbd>}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
