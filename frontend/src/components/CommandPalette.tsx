import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  Search, Home, Users, FolderOpen, User as UserIcon,
  FilePlus2, FileCode2, BookOpen, CornerDownLeft, Info, KeyRound,
  LogIn, LogOut, UserPlus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}

/**
 * ⌘K palette for jumping around the app and starting documents.
 *
 * Keyboard-first: the app is a writing tool, so reaching the editor without
 * leaving the keyboard matters more here than in a typical dashboard.
 */
export function CommandPalette({ open, onClose, isAuthenticated }: Props) {
  const navigate = useNavigate();
  // Signing out was reachable from exactly one place: a ghost button on the
  // profile page, two navigations deep, with nothing in the app's chrome
  // pointing at it. The palette is the one surface reachable from every
  // screen including the editor, so it is where the account actions belong.
  const { logout } = useAuth();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => { navigate({ to }); onClose(); };
    const base: Command[] = [
      { id: 'home', label: 'Home', group: 'Go to', icon: Home, run: go('/') },
      { id: 'community', label: 'Community', group: 'Go to', icon: Users, run: go('/community') },
      { id: 'about', label: 'About Topical', group: 'Go to', icon: Info, run: go('/about') },
    ];
    if (!isAuthenticated) {
      return [
        ...base,
        { id: 'sign-in', label: 'Sign in', group: 'Account', icon: LogIn, run: go('/login') },
        { id: 'sign-up', label: 'Create an account', hint: 'All you need is a topic', group: 'Account', icon: UserPlus, run: go('/register') },
      ];
    }
    return [
      { id: 'new-mdx', label: 'New MDX document', hint: 'Interactive, with live preview', group: 'Create', icon: FilePlus2,
        run: () => { navigate({ to: '/editor', search: { type: 'mdx' } }); onClose(); } },
      { id: 'new-latex', label: 'New LaTeX document', hint: 'For mathematical or scientific writing', group: 'Create', icon: FileCode2,
        run: () => { navigate({ to: '/editor', search: { type: 'latex' } }); onClose(); } },
      { id: 'projects', label: 'Projects', group: 'Go to', icon: FolderOpen, run: go('/projects') },
      ...base,
      { id: 'lessons', label: 'Public lessons', group: 'Go to', icon: BookOpen, run: go('/community') },
      { id: 'profile', label: 'Profile', group: 'Go to', icon: UserIcon, run: go('/profile') },
      { id: 'providers', label: 'AI providers', hint: 'Connect a model', group: 'Go to', icon: KeyRound, run: go('/providers') },
      // Last, and in its own group. It is the one command here that ends the
      // session, so it should never be the thing sitting under the cursor
      // when the palette opens.
      { id: 'sign-out', label: 'Sign out', group: 'Account', icon: LogOut,
        run: () => { onClose(); logout(); } },
    ];
  }, [isAuthenticated, navigate, onClose, logout]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Reset when reopened, and keep the cursor inside the result set as it shrinks.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor(c => (results.length ? (c + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor(c => (results.length ? (c - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        results[cursor]?.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, cursor, onClose]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = '';

  return (
    <div className="cmdk-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search className="h-4 w-4 text-[var(--ink-ghost)] shrink-0" />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search pages and actions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search commands"
          />
          <span className="cmdk-key">ESC</span>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmdk-empty">No results for “{query}”</div>
          ) : (
            results.map((cmd, i) => {
              const header = cmd.group !== lastGroup ? cmd.group : null;
              lastGroup = cmd.group;
              const Icon = cmd.icon;
              return (
                <div key={cmd.id}>
                  {header && <div className="cmdk-group-label">{header}</div>}
                  <button
                    className="cmdk-item"
                    data-index={i}
                    data-active={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={cmd.run}
                  >
                    <Icon className="cmdk-item-icon h-4 w-4" />
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.hint && <span className="text-[11px] text-[var(--ink-ghost)] hidden sm:inline">{cmd.hint}</span>}
                    {i === cursor && <CornerDownLeft className="h-3 w-3 opacity-50" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="cmdk-foot">
          <span><span className="cmdk-key">↑</span> <span className="cmdk-key">↓</span> navigate</span>
          <span><span className="cmdk-key">↵</span> open</span>
        </div>
      </div>
    </div>
  );
}
