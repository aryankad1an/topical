import { useState } from 'react';
import {
  ArrowLeft, Copy, Download, Eye, FileCode, FileDown, Loader2, Printer, Redo2, Save,
  Settings2, SplitSquareHorizontal, Undo2, ListTree, Check, Sun, Moon, Pencil, Link2,
} from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import { Collaborators } from '@/components/Collaborators';
import { ThemeToggle } from '@/components/ThemeToggle';
import { setTheme, useTheme } from '@/lib/theme';
import type { AwarenessCursor } from '@/hooks/useYjsCollab';
import { useDismiss } from '@/hooks/useDismiss';
import type { ViewMode, ViewOptions } from '../lib/viewOptions';

interface Props {
  name: string;
  onRename: (name: string) => void;
  authorUsername: string | null;
  coAuthorUsernames: (string | null)[];
  isAuthor: boolean;
  onManageCoAuthors: () => void;
  peers: AwarenessCursor[];
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => void;
  onBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  viewMode: ViewMode;
  onViewMode: (mode: ViewMode) => void;
  /** One-pane layout: the bar drops everything that is not load-bearing. */
  compact?: boolean;
  /** Whether the writing surface is live, or this is the reading view. */
  editing: boolean;
  /** Start writing. Absent for a viewer who may not. */
  onEdit?: () => void;
  options: ViewOptions;
  onOptions: (next: Partial<ViewOptions>) => void;
  onExport: (kind: 'link' | 'source' | 'copy' | 'print' | 'pdf') => void;
}

const VIEWS: { mode: ViewMode; icon: typeof Eye; label: string }[] = [
  { mode: 'code', icon: FileCode, label: 'Write' },
  { mode: 'split', icon: SplitSquareHorizontal, label: 'Split' },
  { mode: 'preview', icon: Eye, label: 'Read' },
];

export function EditorHeader(props: Props) {
  const [menu, setMenu] = useState<'none' | 'view' | 'export'>('none');
  const theme = useTheme();
  const menuRef = useDismiss(() => setMenu('none'));

  const {
    name, onRename, authorUsername, coAuthorUsernames, isAuthor, onManageCoAuthors,
    peers, isSaving, isDirty, onSave, onBack, onUndo, onRedo,
    viewMode, onViewMode, options, onOptions, onExport, compact, editing, onEdit,
  } = props;

  /*
   * The switch offers what is actually reachable, and nothing else.
   *
   * Reading has one view, so the switch shows one option — it reads as a label
   * for where you are rather than a control that lies about having somewhere
   * to go. Writing offers all three, less Split below the breakpoint, where
   * there is only ever one pane.
   */
  const views = !editing
    ? VIEWS.filter(view => view.mode === 'preview')
    : compact
      ? VIEWS.filter(view => view.mode !== 'split')
      : VIEWS;

  /* Declared once because they appear in one of two places: their own menu
     when there is room for a third header button, and inside the view menu
     when there is not. */
  const exportItems = (
    <>
      {/* First, because on a reading screen it is the commonest thing anyone
          wants from this menu — and because the reading page this shell
          absorbed had it as a button of its own, which was the only control
          the two implementations did not share. */}
      <button className="editor-menu-item" onClick={() => { onExport('link'); setMenu('none'); }}>
        <Link2 className="h-3.5 w-3.5" /> Copy link
      </button>
      <button className="editor-menu-item" onClick={() => { onExport('source'); setMenu('none'); }}>
        <Download className="h-3.5 w-3.5" /> Download source
      </button>
      <button className="editor-menu-item" onClick={() => { onExport('copy'); setMenu('none'); }}>
        <Copy className="h-3.5 w-3.5" /> Copy to clipboard
      </button>
      <button className="editor-menu-item" onClick={() => { onExport('pdf'); setMenu('none'); }}>
        <FileDown className="h-3.5 w-3.5" /> Export PDF…
      </button>
      <button className="editor-menu-item" onClick={() => { onExport('print'); setMenu('none'); }}>
        <Printer className="h-3.5 w-3.5" /> Print
      </button>
    </>
  );

  return (
    <header className="editor-header">
      {/* Up one level, which is this document's reading view — not the
          projects list. Writing is a mode you switch into from reading, so
          leaving it should put you back where you switched from. */}
      <IconButton onClick={onBack} title="Done — back to reading" aria-label="Done — back to reading">
        <ArrowLeft className="h-4 w-4" />
      </IconButton>

      {/* An input you cannot type into is a lie about what it is: reading gets
          the name as a heading, which is also what it is semantically. */}
      {editing ? (
        <input
          className="editor-title"
          value={name}
          onChange={event => onRename(event.target.value)}
          aria-label="Document title"
          spellCheck={false}
        />
      ) : (
        <h1 className="editor-title editor-title--static">{name}</h1>
      )}

      {/* The byline is prose about the document; the collaborator control is
          the part you act on. Narrow, only the second survives — a bar with
          six things in 375px has no room for "by realaryan". */}
      {compact ? (
        <Collaborators
          authorUsername={authorUsername}
          coAuthorUsernames={coAuthorUsernames}
          onManage={isAuthor ? onManageCoAuthors : undefined}
        />
      ) : (
        <div className="editor-byline">
          <span className="editor-byline-label">by</span>
          {/* "you" only when you actually are the owner. This read
              `authorUsername || 'you'` — so a document whose owner has not set
              a handle was announced as yours to every co-author on it. */}
          <span className="editor-byline-name">{authorUsername || (isAuthor ? 'you' : 'a member')}</span>
          {/* The count opens the names, and managing them is offered from inside
              that list rather than as a second button beside it. */}
          <Collaborators
            authorUsername={authorUsername}
            coAuthorUsernames={coAuthorUsernames}
            onManage={isAuthor ? onManageCoAuthors : undefined}
          />
        </div>
      )}

      {editing && !compact && peers.length > 0 && (
        <div className="editor-peers">
          {peers.slice(0, 4).map(peer => (
            <span
              key={peer.clientId}
              className="editor-peer"
              title={`${peer.user.name} is editing`}
              style={{ background: peer.user.color, boxShadow: `0 0 10px ${peer.user.color}55` }}
            >
              {peer.user.name[0]?.toUpperCase()}
            </span>
          ))}
          {peers.length > 4 && <span className="editor-peer editor-peer--more">+{peers.length - 4}</span>}
        </div>
      )}

      {/* The spacer pushes the controls right when there is slack to push
          into. Narrow, there is none — and as a flex item it competed with the
          title for it, which is why the document name came out as "S..". The
          title grows into the gap instead. */}
      {!compact && <div className="flex-1" />}

      {/* Undo and redo keep their keyboard bindings either way; on a narrow
          bar they are the two controls whose absence costs least. */}
      {editing && !compact && (
        <>
          <button className="toolbar-btn" onClick={onUndo} title="Undo  ⌘Z" aria-label="Undo">
            <Undo2 className="h-4 w-4" />
          </button>
          <button className="toolbar-btn" onClick={onRedo} title="Redo  ⌘⇧Z" aria-label="Redo">
            <Redo2 className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Labels off when there is no width for them — the icons carry it, and
          each button keeps its accessible name. */}
      <div className={`segmented${compact ? '' : ' segmented--labeled'} ml-1`}>
        {views.map(view => (
          <button
            key={view.mode}
            data-active={viewMode === view.mode}
            onClick={() => onViewMode(view.mode)}
            title={view.label}
            aria-label={view.label}
          >
            <view.icon className="h-3.5 w-3.5" />
            {!compact && view.label}
          </button>
        ))}
      </div>

      {/* ── Three controls, or one ──
          Wide, the theme switch, the view options and the export menu each get
          their own button. Narrow, they collapse into the view menu: at 375px
          those three cost 114px of a bar that also has to hold the document's
          name, and the name was being squeezed to two characters to pay for
          them. Nothing is dropped — the export actions move inside, and the
          theme becomes a row rather than a switch. */}
      <div className="editor-menus" ref={menuRef}>
        {!compact && <ThemeToggle />}

        <div className="editor-menu-wrap">
          <button
            className="toolbar-btn"
            data-active={menu === 'view'}
            onClick={() => setMenu(menu === 'view' ? 'none' : 'view')}
            title="View options"
            aria-label="View options"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {menu === 'view' && (
            <div className="editor-menu">
              {/* Every one of these is about the writing surface — a rail you
                  edit structure in, numbers on source lines, a focus band
                  around the caret, and scroll sync between two panes. None of
                  them has anything to act on while reading. */}
              {editing && (
                <>
                  <div className="editor-menu-label">Layout</div>
                  <MenuToggle label="Outline rail" icon={ListTree} on={options.outline} onClick={() => onOptions({ outline: !options.outline })} />
                  <MenuToggle label="Line numbers" on={options.lineNumbers} onClick={() => onOptions({ lineNumbers: !options.lineNumbers })} />
                  <MenuToggle label="Focus mode" on={options.focusMode} onClick={() => onOptions({ focusMode: !options.focusMode })} />
                  <MenuToggle label="Sync scrolling" on={options.syncScroll} onClick={() => onOptions({ syncScroll: !options.syncScroll })} />
                </>
              )}

              <div className="editor-menu-label">Text size</div>
              <div className="editor-menu-row">
                <button className="btn-subtle px-2 py-1" onClick={() => onOptions({ fontSize: Math.max(12, options.fontSize - 1) })}>−</button>
                <span className="editor-menu-value">{options.fontSize}px</span>
                <button className="btn-subtle px-2 py-1" onClick={() => onOptions({ fontSize: Math.min(24, options.fontSize + 1) })}>+</button>
              </div>

              {compact && (
                <>
                  <button
                    className="editor-menu-item"
                    onClick={event => {
                      // The theme wipe grows from whatever was pressed, so it
                      // needs this row's position, not the switch's.
                      const box = event.currentTarget.getBoundingClientRect();
                      setTheme(theme === 'dark' ? 'light' : 'dark', {
                        x: box.left + box.width / 2,
                        y: box.top + box.height / 2,
                      });
                      setMenu('none');
                    }}
                  >
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {theme === 'dark' ? 'Light theme' : 'Dark theme'}
                  </button>

                  <div className="editor-menu-label">Export</div>
                  {exportItems}
                </>
              )}
            </div>
          )}
        </div>

        {!compact && (
          <div className="editor-menu-wrap">
            <button
              className="toolbar-btn"
              data-active={menu === 'export'}
              onClick={() => setMenu(menu === 'export' ? 'none' : 'export')}
              title="Export"
              aria-label="Export"
            >
              <Download className="h-4 w-4" />
            </button>

            {menu === 'export' && <div className="editor-menu">{exportItems}</div>}
          </div>
        )}
      </div>

      {/* Reading offers the one control that changes what this screen is;
          writing offers the one that commits it. Compact drops the word, not
          the state — the icon still distinguishes saving from saved, and the
          accessible name still says which. */}
      {editing ? (
        <button
          className="accent-btn editor-save"
          onClick={onSave}
          disabled={isSaving}
          title={isSaving ? 'Saving' : isDirty ? 'Save' : 'Saved'}
          aria-label={isSaving ? 'Saving' : isDirty ? 'Save' : 'Saved'}
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {!compact && (isSaving ? 'Saving' : isDirty ? 'Save' : 'Saved')}
        </button>
      ) : onEdit ? (
        <button className="accent-btn editor-save" onClick={onEdit} title="Edit" aria-label="Edit">
          <Pencil className="h-3.5 w-3.5" />
          {!compact && 'Edit'}
        </button>
      ) : null}
    </header>
  );
}

function MenuToggle({ label, icon: Icon, on, onClick }: {
  label: string;
  icon?: typeof ListTree;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button className="editor-menu-item" data-on={on} onClick={onClick} role="menuitemcheckbox" aria-checked={on}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="editor-menu-spacer" />}
      {label}
      {on && <Check className="h-3.5 w-3.5 ml-auto" />}
    </button>
  );
}
