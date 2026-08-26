import { createFileRoute, redirect } from '@tanstack/react-router';
import type { DocFormat } from '@/lib/types';

/** What the old editor read out of its own URL. */
export interface EditorSearch {
  id?: number;
  type?: DocFormat;
}

/**
 * `/editor?id=…&type=…`, kept only to forward links that already exist.
 *
 * The editor is a mode of the document route now, not a destination:
 * `/projects/mdx/12201?mode=write`. Two things follow from that, and both are
 * the point.
 *
 * A document reached this way used to be loaded through the owner-or-co-author
 * endpoint, so following a link to someone else's published work landed on an
 * empty writing surface and a "Failed to load project" toast. And the URL was
 * unshareable by construction: it asserted that whoever opened it was there to
 * write.
 *
 * There is also no id-less case left to forward. A document is created before
 * it is opened — the projects page already worked that way, and the command
 * palette now does too — so "a new document that does not exist yet" is not a
 * state the editor can be in.
 */
export const Route = createFileRoute('/_authenticated/editor')({
  validateSearch: (search: Record<string, unknown>): EditorSearch => {
    const id = Number(search.id);
    return {
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      type: search.type === 'latex' ? 'latex' : 'mdx',
    };
  },
  beforeLoad: ({ search }) => {
    throw search.id
      ? redirect({
          to: '/projects/$format/$id',
          params: { format: search.type ?? 'mdx', id: String(search.id) },
          search: { mode: 'write' as const },
          replace: true,
        })
      : redirect({ to: '/projects', replace: true });
  },
});
