/**
 * Where a document lives, as a URL.
 *
 * Every document now has one address — `/projects/mdx/12201` — and this is the
 * only place that builds it. Before, a document was reached through the
 * editor's query string (`/editor?id=12201&type=mdx`) or the reader's
 * (`/read?id=12201`), and which of the two you got was decided by the *call
 * site*: the projects page always sent you to the editor, the community page
 * chose by comparing owner ids in the browser, and the profile page sent you
 * to the editor for documents you had no access to at all. None of those URLs
 * could be given to anyone, because none of them named the document
 * independently of what the sender happened to be allowed to do with it.
 *
 * The address says which document. The server says what you may do with it.
 */

import { formatOf } from '@/lib/types';

/**
 * The route a document is opened at. Spread into `Link` or `navigate`.
 *
 * Reading is the default because opening a document is not the same as
 * editing it — pass `'write'` only where the caller genuinely means "start
 * writing now", which is the moment a document is first created.
 */
export function documentRoute(id: number, mainTopic?: string | null, mode?: 'write') {
  return {
    to: '/projects/$format/$id' as const,
    params: { format: formatOf(mainTopic), id: String(id) },
    search: mode === 'write' ? { mode: 'write' as const } : {},
  };
}

/**
 * The absolute URL to hand to someone else.
 *
 * Only for the copy-link affordance — navigation inside the app uses
 * `documentRoute` so it stays client-side.
 */
export function documentShareUrl(id: number, mainTopic?: string | null): string {
  const { params } = documentRoute(id, mainTopic);
  return `${window.location.origin}/projects/${params.format}/${params.id}`;
}
