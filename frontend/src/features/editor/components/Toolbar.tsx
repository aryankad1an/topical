import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Keyboard, ListTree, Slash, Upload } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import { Chip } from '@/components/ui/primitives';
import { actionById, TOOLBAR_GROUPS, type EditorAction } from '../lib/actions';

interface Props {
  format: DocFormat;
  onRun: (action: EditorAction) => void;
  onUploadImage: () => void;
  /** Whether the outline rail is showing. */
  outlineOpen: boolean;
  onToggleOutline: () => void;
  /** Opens the keyboard-shortcut sheet. */
  onShowShortcuts: () => void;
}

const SHORTCUT_HINT: Record<string, string> = {
  bold: '⌘B', italic: '⌘I', code: '⌘E', link: '⌘K',
  h1: '⌘1', h2: '⌘2', h3: '⌘3',
};

/**
 * The formatting bar.
 *
 * A real `role="toolbar"` with **roving tabindex**: the whole bar is one stop
 * in the tab order and the arrow keys move within it. Eighteen buttons that
 * each take a Tab press is eighteen presses between the document title and
 * the text you were trying to reach, which is the difference between a bar a
 * keyboard user tolerates and one they route around.
 *
 * Every button is the same action the `/` menu runs.
 */
export function Toolbar({
  format, onRun, onUploadImage, outlineOpen, onToggleOutline, onShowShortcuts,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  /**
   * Which group has its overflow open, and where to draw it.
   *
   * The menu is portalled to the body and positioned from the chevron's own
   * rect, because it cannot survive being a child of the bar: `.editor-toolbar`
   * is `overflow: auto` (so it scrolls on a narrow window), which clips it, and
   * it carries `backdrop-filter`, which makes it a stacking context that no
   * `z-index` can climb out of. This is the trap `.editor-menu` in the header
   * hit before — same cause, and the same reason a popover anchored in frosted
   * chrome has to leave it.
   */
  const [openGroup, setOpenGroup] = useState<{ label: string; x: number; y: number } | null>(null);

  // A menu on a toolbar is dismissed by doing almost anything else.
  useEffect(() => {
    if (!openGroup) return;
    const close = () => setOpenGroup(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    // Scrolling the bar or the page moves the chevron out from under a menu
    // that is fixed to the viewport, so the menu goes rather than drift.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [openGroup]);

  /**
   * Arrow keys move focus; Home and End jump to the ends.
   *
   * Focus is read off the DOM rather than tracked in state, so the bar cannot
   * disagree with where focus actually is — the two drift apart the moment a
   * button is disabled or the format changes the set of actions.
   */
  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const items = Array.from(
      barRef.current?.querySelectorAll<HTMLButtonElement>('[data-toolbar-item]') ?? [],
    );
    if (!items.length) return;

    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowRight' ? (current + 1) % items.length
      : (current - 1 + items.length) % items.length;

    event.preventDefault();
    items[next]?.focus();
  }, []);

  /** Only one item is tabbable; the rest are reached with the arrows. */
  const roving = (index: number) => ({
    'data-toolbar-item': true,
    tabIndex: index === 0 ? 0 : -1,
  });

  let index = 0;

  return (
    <div
      className="editor-toolbar"
      role="toolbar"
      aria-label="Formatting"
      aria-orientation="horizontal"
      ref={barRef}
      onKeyDown={onKeyDown}
    >
      <Chip tone={format === 'latex' ? 'latex' : 'accent'} mono>
        {format === 'latex' ? 'LaTeX' : 'MDX'}
      </Chip>

      <span className="toolbar-divider" role="separator" aria-orientation="vertical" />

      {/* The outline is the spine of the document here, so its toggle belongs
          on the bar rather than three clicks deep in the view menu. */}
      <button
        className="toolbar-toggle"
        data-active={outlineOpen}
        onClick={onToggleOutline}
        aria-pressed={outlineOpen}
        title={outlineOpen ? 'Hide the outline  ⌘\\' : 'Show the outline  ⌘\\'}
        {...roving(index++)}
      >
        <ListTree className="h-3.5 w-3.5" />
        Outline
      </button>

      <span className="toolbar-divider" role="separator" aria-orientation="vertical" />

      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <div className="toolbar-group" role="group" aria-label={group.label} key={group.label}>
          {groupIndex > 0 && (
            <span className="toolbar-divider" role="separator" aria-orientation="vertical" />
          )}
          {group.ids.map(id => {
            const action = actionById(format, id);
            if (!action) return null;
            const Icon = action.icon;
            const hint = SHORTCUT_HINT[action.id];
            return (
              <button
                key={action.id}
                className="toolbar-btn"
                onClick={() => onRun(action)}
                title={hint ? `${action.label}  ${hint}` : action.label}
                aria-label={hint ? `${action.label}, ${hint}` : action.label}
                aria-keyshortcuts={hint ? hint.replace('⌘', 'Meta+') : undefined}
                {...roving(index++)}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}

          {/* The rest of the group, one chevron away. Actions that belong
              together but are reached once a session do not earn a permanent
              slot on a bar that has to stay scannable. */}
          {group.more && group.more.length > 0 && (
            <div className="toolbar-more">
              <button
                className="toolbar-btn toolbar-more-btn"
                data-active={openGroup?.label === group.label}
                onClick={e => {
                  e.stopPropagation();
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setOpenGroup(g => (g?.label === group.label
                    ? null
                    : { label: group.label, x: r.left, y: r.bottom + 6 }));
                }}
                title={`More ${group.label.toLowerCase()}`}
                aria-label={`More ${group.label.toLowerCase()}`}
                aria-haspopup="menu"
                aria-expanded={openGroup?.label === group.label}
                {...roving(index++)}
              >
                <ChevronDown className="h-3 w-3" />
              </button>

              {openGroup?.label === group.label && createPortal(
                <div
                  className="toolbar-menu"
                  role="menu"
                  style={{ left: openGroup.x, top: openGroup.y }}
                  onClick={e => e.stopPropagation()}
                >
                  {group.more.map(id => {
                    const action = actionById(format, id);
                    if (!action) return null;
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        role="menuitem"
                        className="toolbar-menu-item"
                        onClick={() => { onRun(action); setOpenGroup(null); }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>,
                document.body,
              )}
            </div>
          )}
        </div>
      ))}

      <span className="toolbar-divider" role="separator" aria-orientation="vertical" />

      <button
        className="toolbar-btn"
        onClick={onUploadImage}
        title="Upload an image"
        aria-label="Upload an image"
        {...roving(index++)}
      >
        <Upload className="h-4 w-4" />
      </button>

      <div className="toolbar-tail">
        <span className="toolbar-hint">
          <Slash className="h-3 w-3" aria-hidden="true" />
          type <kbd>/</kbd> for everything else
        </span>
        <button
          className="toolbar-btn"
          onClick={onShowShortcuts}
          title="Keyboard shortcuts  ⌘/"
          aria-label="Keyboard shortcuts"
          aria-keyshortcuts="Meta+/"
          {...roving(index++)}
        >
          <Keyboard className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
