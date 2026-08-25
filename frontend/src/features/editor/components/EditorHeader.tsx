import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, Copy, Download, Eye, FileCode, FileDown, Loader2, Printer, Redo2, Save,
  Settings2, SplitSquareHorizontal, Undo2, Users, ListTree, Check,
} from 'lucide-react';
import { IconButton } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { AwarenessCursor } from '@/hooks/useYjsCollab';
import type { ViewMode, ViewOptions } from '../lib/viewOptions';

interface Props {
  name: string;
  onRename: (name: string) => void;
  authorUsername: string | null;
  coAuthorUsernames: string[];
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
  options: ViewOptions;
  onOptions: (next: Partial<ViewOptions>) => void;
  onExport: (kind: 'source' | 'copy' | 'print' | 'pdf') => void;
}

const VIEWS: { mode: ViewMode; icon: typeof Eye; label: string }[] = [
  { mode: 'code', icon: FileCode, label: 'Write' },
  { mode: 'split', icon: SplitSquareHorizontal, label: 'Split' },
  { mode: 'preview', icon: Eye, label: 'Read' },
];

/**
 * Closes a popover when the pointer goes anywhere else.
 *
 * The returned ref must wrap every trigger as well as the menus themselves —
 * a trigger left outside it gets its menu closed on mousedown and reopened on
 * click, so it can never toggle off.
 */
function useDismiss(onDismiss: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onDismiss]);
  return ref;
}

export function EditorHeader(props: Props) {
  const [menu, setMenu] = useState<'none' | 'view' | 'export'>('none');
  const menuRef = useDismiss(() => setMenu('none'));

  const {
    name, onRename, authorUsername, coAuthorUsernames, isAuthor, onManageCoAuthors,
    peers, isSaving, isDirty, onSave, onBack, onUndo, onRedo,
    viewMode, onViewMode, options, onOptions, onExport,
  } = props;

  return (
    <header className="editor-header">
      <IconButton onClick={onBack} title="Back to projects" aria-label="Back to projects">
        <ArrowLeft className="h-4 w-4" />
      </IconButton>

      <input
        className="editor-title"
        value={name}
        onChange={event => onRename(event.target.value)}
        aria-label="Document title"
        spellCheck={false}
      />

      <div className="editor-byline">
        <span className="editor-byline-label">by</span>
        <span className="editor-byline-name">{authorUsername || 'you'}</span>
        {coAuthorUsernames.length > 0 && (
          <span className="editor-byline-co">
            +{coAuthorUsernames.length} {coAuthorUsernames.length === 1 ? 'collaborator' : 'collaborators'}
          </span>
        )}
        {isAuthor && (
          <button className="btn-subtle btn-subtle--pill px-2.5 py-1" onClick={onManageCoAuthors}>
            <Users className="h-3.5 w-3.5" /> Share
          </button>
        )}
      </div>

      {peers.length > 0 && (
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

      <div className="flex-1" />

      <button className="toolbar-btn" onClick={onUndo} title="Undo  ⌘Z" aria-label="Undo">
        <Undo2 className="h-4 w-4" />
      </button>
      <button className="toolbar-btn" onClick={onRedo} title="Redo  ⌘⇧Z" aria-label="Redo">
        <Redo2 className="h-4 w-4" />
      </button>

      <div className="segmented segmented--labeled ml-1">
        {VIEWS.map(view => (
          <button key={view.mode} data-active={viewMode === view.mode} onClick={() => onViewMode(view.mode)}>
            <view.icon className="h-3.5 w-3.5" />
            {view.label}
          </button>
        ))}
      </div>

      <div className="editor-menus" ref={menuRef}>
        <ThemeToggle />

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
              <div className="editor-menu-label">Layout</div>
              <MenuToggle label="Outline rail" icon={ListTree} on={options.outline} onClick={() => onOptions({ outline: !options.outline })} />
              <MenuToggle label="Line numbers" on={options.lineNumbers} onClick={() => onOptions({ lineNumbers: !options.lineNumbers })} />
              <MenuToggle label="Focus mode" on={options.focusMode} onClick={() => onOptions({ focusMode: !options.focusMode })} />
              <MenuToggle label="Sync scrolling" on={options.syncScroll} onClick={() => onOptions({ syncScroll: !options.syncScroll })} />

              <div className="editor-menu-label">Text size</div>
              <div className="editor-menu-row">
                <button className="btn-subtle px-2 py-1" onClick={() => onOptions({ fontSize: Math.max(12, options.fontSize - 1) })}>−</button>
                <span className="editor-menu-value">{options.fontSize}px</span>
                <button className="btn-subtle px-2 py-1" onClick={() => onOptions({ fontSize: Math.min(24, options.fontSize + 1) })}>+</button>
              </div>
            </div>
          )}
        </div>

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

          {menu === 'export' && (
            <div className="editor-menu">
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
            </div>
          )}
        </div>
      </div>

      <button className="accent-btn editor-save" onClick={onSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {isSaving ? 'Saving' : isDirty ? 'Save' : 'Saved'}
      </button>
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
