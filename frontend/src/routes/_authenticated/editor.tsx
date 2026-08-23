import { createFileRoute } from '@tanstack/react-router';
import { EditorPage } from '@/features/editor/EditorPage';
import type { DocFormat } from '@/lib/types';

/** What the editor reads out of its own URL. */
export interface EditorSearch {
  /** Document to open. Absent starts a new, unsaved one. */
  id?: number;
  /** Language for a new document; an existing one carries its own. */
  type?: DocFormat;
}

/**
 * The editor's URL contract, declared once.
 *
 * Without it the router types this route's search as empty, so all six
 * `navigate({ to: '/editor', ... })` call sites had to escape the type system
 * — two with `as any`, four with `as never` — and the editor read its own
 * parameters back through an unchecked cast. Normalising here means a
 * hand-typed `?id=abc` becomes "new document" rather than `NaN`.
 */
export const Route = createFileRoute('/_authenticated/editor')({
  component: EditorPage,
  validateSearch: (search: Record<string, unknown>): EditorSearch => {
    const id = Number(search.id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      type: search.type === 'latex' ? 'latex' : 'mdx',
    };
  },
});
