import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { DocFormat } from '@/lib/types';

/**
 * Every keyboard shortcut the editor binds, in one sheet.
 *
 * The bindings already existed; nothing here adds behaviour. What was missing
 * was any way to find them — they lived in `title` attributes, which a
 * keyboard user never hovers and a screen reader announces one at a time.
 *
 * The list is written out rather than derived from the action registry
 * because it also covers chords no toolbar button owns (find, save, the
 * outline toggle, the `/` menu), and a table that only documented half of
 * them would be worse than none.
 */

type Row = { keys: string[]; label: string };
type Section = { title: string; rows: Row[] };

const COMMON: Section[] = [
  {
    title: 'Document',
    rows: [
      { keys: ['⌘', 'S'], label: 'Save now' },
      { keys: ['⌘', 'Z'], label: 'Undo' },
      { keys: ['⌘', '⇧', 'Z'], label: 'Redo' },
      { keys: ['⌘', 'F'], label: 'Find and replace' },
      { keys: ['⌘', '\\'], label: 'Show or hide the outline' },
      { keys: ['⌘', '/'], label: 'This list' },
    ],
  },
  {
    title: 'Writing',
    rows: [
      { keys: ['/'], label: 'Open the menu of every construct' },
      { keys: ['⌘', 'J'], label: 'Rewrite the selection with AI' },
      { keys: ['Tab'], label: 'Indent the current block' },
      { keys: ['⇧', 'Tab'], label: 'Outdent the current block' },
      { keys: ['Enter'], label: 'Continue a list or environment' },
    ],
  },
];

const MDX_FORMAT: Section = {
  title: 'Formatting',
  rows: [
    { keys: ['⌘', 'B'], label: 'Bold' },
    { keys: ['⌘', 'I'], label: 'Italic' },
    { keys: ['⌘', 'E'], label: 'Inline code' },
    { keys: ['⌘', 'K'], label: 'Link' },
    { keys: ['⌘', '1'], label: 'Heading 1' },
    { keys: ['⌘', '2'], label: 'Heading 2' },
    { keys: ['⌘', '3'], label: 'Heading 3' },
  ],
};

const OUTLINE: Section = {
  title: 'Outline rail',
  rows: [
    { keys: ['Tab'], label: 'Indent a section (on a row)' },
    { keys: ['⇧', 'Tab'], label: 'Outdent a section' },
    { keys: ['Enter'], label: 'Rename the focused section' },
    { keys: ['↑', '↓'], label: 'Move between sections' },
  ],
};

export function ShortcutsSheet({
  open, onClose, format,
}: {
  open: boolean;
  onClose: () => void;
  format: DocFormat;
}) {
  const sections = [...COMMON, MDX_FORMAT, OUTLINE];

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {format === 'latex'
              ? 'LaTeX documents bind the same chords; the constructs they insert differ.'
              : 'Everything the editor binds. ⌘ is Ctrl on Windows and Linux.'}
          </DialogDescription>
        </DialogHeader>

        <div className="shortcut-columns">
          {sections.map(section => (
            <section key={section.title} className="shortcut-section">
              <h3 className="shortcut-heading">{section.title}</h3>
              <dl className="shortcut-list">
                {section.rows.map(row => (
                  <div className="shortcut-row" key={row.label}>
                    <dt className="shortcut-label">{row.label}</dt>
                    <dd className="shortcut-keys">
                      {row.keys.map(key => <kbd key={key}>{key}</kbd>)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
