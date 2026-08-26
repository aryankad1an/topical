import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { fetchSharedDocument, type SharedDocument } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatOf, type DocFormat } from '@/lib/types';
import { DocumentView } from '@/features/editor/EditorPage';
import { EmptyState } from '@/components/ui/primitives';

/**
 * Read or write — which of the two the screen is showing right now.
 *
 * In the URL rather than in component state, for the same reason Google Docs
 * puts `/edit` in its own: a writer who reloads, or bookmarks, or opens the
 * document in a second tab, should get back the mode they were in. It also
 * means switching modes is a search change on the *same* route, so the loaded
 * document is not thrown away and refetched to cross between them — and,
 * because both modes are now the same component, not even remounted.
 */
export interface DocumentSearch {
  mode?: 'write';
}

/**
 * One document, at one address.
 *
 * `/projects/mdx/12201` names the document and nothing else. It does not say
 * what the person holding it may do — the server says that, once, and this
 * route shows the reader, the editor, or a locked notice accordingly.
 *
 * What this replaces: `/editor?id=…` and `/read?id=…`, where the *caller*
 * decided which one you got. The projects page always sent you to the editor,
 * the community page chose by comparing owner ids in the browser, and the
 * profile page sent you to the editor for documents you had no access to —
 * which loaded, failed, and left you on a blank writing surface. None of the
 * three URLs could be handed to anyone else, because each one encoded an
 * assumption about who was holding it.
 */
export const Route = createFileRoute('/projects/$format/$id')({
  component: DocumentPage,
  validateSearch: (search: Record<string, unknown>): DocumentSearch => ({
    mode: search.mode === 'write' ? 'write' : undefined,
  }),
});

function DocumentPage() {
  const { format: urlFormat, id: rawId } = Route.useParams();
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const id = Number(rawId);
  const valid = Number.isInteger(id) && id > 0;

  const { data, isLoading, error } = useQuery<SharedDocument>({
    queryKey: ['document', id],
    queryFn: () => fetchSharedDocument(id),
    enabled: valid,
    retry: false,
    // Switching between reading and writing re-runs this query's component;
    // without a stale window that would be a refetch on every mode change.
    staleTime: 30_000,
  });

  const plan = data?.plan;
  const format: DocFormat = plan ? formatOf(plan.mainTopic) : 'mdx';

  /*
   * The format in the path is a label, not the truth — the document carries
   * its own. A link typed or shared with the wrong one still opens the right
   * document; the address bar is then quietly corrected so the URL that gets
   * copied onward is the right one.
   */
  useEffect(() => {
    if (!plan || urlFormat === format) return;
    navigate({
      to: '/projects/$format/$id',
      params: { format, id: rawId },
      search: { mode },
      replace: true,
    });
  }, [format, mode, navigate, plan, rawId, urlFormat]);

  const setMode = useCallback((next: 'read' | 'write') => {
    navigate({
      to: '/projects/$format/$id',
      params: { format, id: rawId },
      search: next === 'write' ? { mode: 'write' as const } : {},
    });
  }, [format, navigate, rawId]);

  const toRead = useCallback(() => setMode('read'), [setMode]);
  const toWrite = useCallback(() => setMode('write'), [setMode]);
  const toProjects = useCallback(() => navigate({ to: '/projects' }), [navigate]);

  if (!valid) return <Unavailable known={false} isAuthenticated={isAuthenticated} />;

  if (isLoading) {
    return (
      <div className="doc-route-loading">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent-500)' }} />
      </div>
    );
  }

  // The server answers "private" and "does not exist" identically on purpose —
  // whether an id is real is not something a stranger with a URL gets to probe
  // — so this notice has to cover both without claiming to know which.
  if (error || !plan) return <Unavailable known isAuthenticated={isAuthenticated} />;

  const mayWrite = data.access !== 'reader';
  const editing = mode === 'write' && mayWrite;

  /*
   * One component for both. Reading is the same shell with the writing surface
   * absent — see `DocumentView`. Keyed on the id so that opening a *different*
   * document builds a fresh one rather than re-seeding the previous one's
   * state; deliberately not keyed on the mode, so crossing between reading and
   * writing keeps the loaded document and the scroll position.
   */
  return (
    <DocumentView
      key={plan.id}
      plan={plan}
      isOwner={data.access === 'owner'}
      editing={editing}
      onEdit={mayWrite && !editing ? toWrite : undefined}
      // Up one level: writing goes back to reading, reading goes back out.
      onBack={editing ? toRead : toProjects}
    />
  );
}

/**
 * The document is private, gone, or was never real.
 *
 * A signed-out visitor gets the sign-in route as well: the commonest way to
 * land here is to follow a colleague's link to a document you are named on
 * before this browser has a session, and telling that person only "private"
 * is both unhelpful and untrue.
 */
function Unavailable({ known, isAuthenticated }: { known: boolean; isAuthenticated: boolean }) {
  const { pathname, search } = window.location;
  return (
    <div className="page-shell page-shell--narrow">
      <EmptyState
        icon={Lock}
        title={known ? 'This project is private' : 'That link does not name a project'}
        description={known
          ? isAuthenticated
            ? 'It has not been published, and you are not on it as an author or collaborator. Ask its owner to add you or publish it.'
            : 'You may have access to it — sign in and try the link again.'
          : 'Check the link, or browse what has been published.'}
        action={
          <div className="flex items-center gap-2">
            {known && !isAuthenticated && (
              <Link to="/login" search={{ redirect: `${pathname}${search}` }} className="accent-btn px-4 py-2 rounded-full text-xs">
                Sign in
              </Link>
            )}
            <Link to="/community" className="btn-subtle btn-subtle--pill px-4 py-2">
              Browse the community
            </Link>
          </div>
        }
      />
    </div>
  );
}
