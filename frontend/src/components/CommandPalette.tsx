import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getLessonPlans } from '@/lib/api';
import { createDocument } from '@/lib/newDocument';
import { documentRoute } from '@/lib/documentUrl';
import { formatOf, type DocFormat } from '@/lib/types';
import {
  Search, Home, Users, FolderOpen, User as UserIcon,
  FilePlus2, FileCode2, BookOpen, CornerDownLeft, Info, KeyRound,
  LogIn, LogOut, UserPlus, FileText, Settings2, Moon, Keyboard,
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
/** One shared empty list, so "no projects" is a stable reference. */
const EMPTY: never[] = [];

export function CommandPalette({ open, onClose, isAuthenticated }: Props) {
  const navigate = useNavigate();
  // Signing out was reachable from exactly one place: a ghost button on the
  // profile page, two navigations deep, with nothing in the app's chrome
  // pointing at it. The palette is the one surface reachable from every
  // screen including the editor, so it is where the account actions belong.
  const { logout } = useAuth();
  const queryClient = useQueryClient();

  /**
   * Start a document, then open it.
   *
   * These two commands used to navigate to a blank `/editor?type=…` and leave
   * the row uncreated until the first save — the last path in the app that
   * could put you in front of a document with no address. Creating it first
   * costs one round trip and means the URL in the bar is shareable from the
   * first keystroke.
   */
  const startDocument = useCallback(async (format: DocFormat) => {
    onClose();
    try {
      const plan = await createDocument('', format);
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      navigate(documentRoute(plan.id, plan.mainTopic, 'write'));
    } catch {
      toast.error('Could not start a document');
    }
  }, [navigate, onClose, queryClient]);

  /**
   * The signed-in writer's own documents, offered by name.
   *
   * The palette could reach every *page* in the product and none of the
   * writer's actual work — so the one thing a writing tool is opened to find,
   * "the piece I was working on", was the one thing ⌘K could not find. Loaded
   * only while the palette is open, and served from the same query cache the
   * projects page fills, so opening it twice costs one request.
   */
  const { data: projectData } = useQuery({
    queryKey: ['user-lesson-plans'],
    queryFn: getLessonPlans,
    enabled: open && isAuthenticated,
    staleTime: 30_000,
  });
  // `?? []` inline is a fresh array on every render with no data, which is
  // enough on its own to defeat the memo below.
  const projects = projectData?.lessonPlans ?? EMPTY;
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
        run: () => { startDocument('mdx'); } },
      { id: 'new-latex', label: 'New LaTeX document', hint: 'For mathematical or scientific writing', group: 'Create', icon: FileCode2,
        run: () => { startDocument('latex'); } },
      { id: 'projects', label: 'Projects', group: 'Go to', icon: FolderOpen, run: go('/projects') },
      ...base,
      { id: 'lessons', label: 'Public lessons', group: 'Go to', icon: BookOpen, run: go('/community') },
      { id: 'profile', label: 'Profile', group: 'Go to', icon: UserIcon, run: go('/profile') },
      { id: 'providers', label: 'AI providers', hint: 'Connect a model', group: 'Go to', icon: KeyRound, run: go('/providers') },
      { id: 'edit-profile', label: 'Edit profile', hint: 'Name, handle, bio', group: 'Go to', icon: Settings2, run: go('/profile/edit') },

      // The writer's own documents, by name. Listed after the fixed commands
      // so an empty query still opens on the same five rows every time — a
      // palette whose first row depends on how many projects you have is one
      // you cannot build muscle memory against.
      ...projects.map(plan => ({
        id: `doc-${plan.id}`,
        label: plan.name,
        hint: formatOf(plan.mainTopic) === 'latex' ? 'LaTeX document' : 'MDX document',
        group: 'Your documents',
        icon: FileText,
        run: () => {
          navigate(documentRoute(plan.id, plan.mainTopic));
          onClose();
        },
      })),
      // Last, and in its own group. It is the one command here that ends the
      // session, so it should never be the thing sitting under the cursor
      // when the palette opens.
      { id: 'theme', label: 'Toggle dark mode', group: 'Account', icon: Moon,
        run: () => {
          const root = document.documentElement;
          const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
          root.dataset.theme = next;
          root.style.colorScheme = next;
          try { localStorage.setItem('topical_theme', next); } catch { /* private mode */ }
          onClose();
        } },
      { id: 'shortcuts', label: 'Keyboard shortcuts', hint: '⌘/ in the editor', group: 'Account', icon: Keyboard,
        run: () => { onClose(); window.dispatchEvent(new CustomEvent('topical:shortcuts')); } },
      { id: 'sign-out', label: 'Sign out', group: 'Account', icon: LogOut,
        run: () => { onClose(); logout(); } },
    ];
  }, [isAuthenticated, navigate, onClose, logout, projects, startDocument]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(c =>
      c.label.toLowerCase().includes(q)
      || c.group.toLowerCase().includes(q)
      || (c.hint?.toLowerCase().includes(q) ?? false),
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
