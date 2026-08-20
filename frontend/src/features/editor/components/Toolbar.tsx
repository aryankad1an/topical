import { Upload, Slash } from 'lucide-react';
import type { DocFormat } from '@/lib/types';
import { Chip } from '@/components/ui/primitives';
import { actionById, TOOLBAR_IDS, type EditorAction } from '../lib/actions';

interface Props {
  format: DocFormat;
  onRun: (action: EditorAction) => void;
  onUploadImage: () => void;
}

const SHORTCUT_HINT: Record<string, string> = {
  bold: '⌘B', italic: '⌘I', code: '⌘E', link: '⌘K',
  h1: '⌘1', h2: '⌘2', h3: '⌘3',
};

/** Formatting row. Every button is the same action the `/` menu runs. */
export function Toolbar({ format, onRun, onUploadImage }: Props) {
  return (
    <div className="editor-toolbar">
      <Chip tone={format === 'latex' ? 'latex' : 'accent'} mono>
        {format === 'latex' ? 'LaTeX' : 'MDX'}
      </Chip>

      <div className="toolbar-divider" />

      {TOOLBAR_IDS.map((id, index) => {
        if (id === '|') return <div key={`sep-${index}`} className="toolbar-divider" />;
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
            aria-label={action.label}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}

      <div className="toolbar-divider" />

      <button className="toolbar-btn" onClick={onUploadImage} title="Upload an image" aria-label="Upload an image">
        <Upload className="h-4 w-4" />
      </button>

      <span className="toolbar-hint">
        <Slash className="h-3 w-3" />
        type <kbd>/</kbd> for everything else
      </span>
    </div>
  );
}
