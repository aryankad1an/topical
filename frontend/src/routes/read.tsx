import { createFileRoute, redirect } from '@tanstack/react-router';

/** What the old reader read out of its own URL. */
export interface ReaderSearch {
  id?: number;
}

/**
 * `/read?id=22`, kept only to forward links that already exist.
 *
 * Reading is no longer a separate destination. A document has one address —
 * `/projects/mdx/22` — and whether it opens for reading or for writing is
 * decided there, from what the server says this viewer may do, rather than
 * from which of two URLs they happened to be handed.
 *
 * The format is guessed as `mdx` because this URL never carried one. The
 * document route corrects the path from the document's own format once it has
 * loaded it, so a forwarded LaTeX document lands right and then tidies its own
 * address bar.
 */
export const Route = createFileRoute('/read')({
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const id = Number(search.id);
    return { id: Number.isFinite(id) && id > 0 ? id : undefined };
  },
  beforeLoad: ({ search }) => {
    throw search.id
      ? redirect({
          to: '/projects/$format/$id',
          params: { format: 'mdx', id: String(search.id) },
          replace: true,
        })
      : redirect({ to: '/community', replace: true });
  },
});
