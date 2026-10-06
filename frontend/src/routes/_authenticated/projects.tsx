/**
 * The projects workspace: the documents you own or co-author.
 *
 * A project's format is carried in its `mainTopic` (a `latex:` prefix), not a
 * separate column, so `formatOf` in `@/lib/types` is the single place that
 * decides — see the note there.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getLessonPlans, deleteLessonPlan, saveLessonPlan, LessonPlanResponse } from '@/lib/api';
import { createDocument } from '@/lib/newDocument';
import { documentRoute } from '@/lib/documentUrl';
import { formatDate } from '@/lib/format';
import type { DocFormat } from '@/lib/types';
import { Plus, FolderOpen, LayoutGrid, List } from 'lucide-react';
import { TopicStarter } from '@/components/projects/TopicStarter';
import { DocumentCard, DocumentRow, wordCount } from '@/components/projects/DocumentCard';
import { EmptyState, PageHeader, Refreshing, Button, SearchField, Segmented, Skeleton, Page, ConfirmDialog } from '@/components/ui';
import { VisibilityChip } from '@/components/projects/VisibilityChip';

export const Route = createFileRoute('/_authenticated/projects')({ component: ProjectsPage });

/** One shared empty list, so "no projects yet" is a stable reference. */
const EMPTY: never[] = [];

function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  /**
   * The publish or unpublish awaiting confirmation, and the one in flight.
   *
   * Publishing is outward-facing — it puts the document in front of everyone —
   * and unpublishing breaks links other people may already be holding. Neither
   * should happen because a switch was brushed on the way past, so both are
   * confirmed, and the card says so while the request is running rather than
   * appearing to have done nothing for the length of a round trip.
   */
  const [publishAsk, setPublishAsk] = useState<{ plan: LessonPlanResponse; next: boolean } | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');



  const { data: projectsData, isLoading, isFetching } = useQuery({
    queryKey: ['user-lesson-plans'],
    queryFn: getLessonPlans,
    enabled: !!user,
    /* The command palette already reads this exact cache key with a 30s stale
       window; this page had none, so the two disagreed about the same data and
       every return to the workspace refired the request. The list carries the
       full text of every document — it is what the cards' thumbnails and word
       counts are drawn from — so that is not a cheap round trip, and the
       database is not in the same region as the app. */
    staleTime: 30_000,
  });

  /* `?? EMPTY` rather than `?? []`: a fresh literal is a new reference on every
     render with no data, which alone defeats every memo below it. */
  const projects = projectsData?.lessonPlans ?? EMPTY;

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return needle ? projects.filter(p => p.name.toLowerCase().includes(needle)) : projects;
  }, [projects, searchQuery]);

  /*
   * Workspace stats — a document count alone said little about the work itself.
   *
   * Memoised because `wordCount` is not cheap: it concatenates every section of
   * a document, runs a regex over the whole thing and splits it on whitespace.
   * Across a hundred documents that is megabytes of string work, and it was
   * running on *every* render of this page — including once per keystroke in
   * the search field, and again on every route change, because the page had
   * subscribed itself to the whole router state through the shell above it.
   * Returning to the workspace from the editor is the case that showed it.
   */
  const stats = useMemo(() => {
    let totalWords = 0;
    let publicCount = 0;
    let lastEdited: string | null = null;
    for (const plan of projects) {
      totalWords += wordCount(plan);
      if (plan.isPublic) publicCount += 1;
      const edited = plan.updatedAt ?? plan.createdAt;
      // One pass and a running maximum, rather than building an array of every
      // date and sorting it to read off the last element.
      if (edited && (lastEdited === null || edited > lastEdited)) lastEdited = edited;
    }
    return { totalWords, publicCount, lastEdited };
  }, [projects]);
  const { totalWords, publicCount, lastEdited } = stats;

  // Fixed for as long as the page is open; it does not need recomputing per render.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  /**
   * The topic is the document's name and its subject at once — which is what
   * it always was. The dialog this replaces asked for a "project name" and
   * then wrote that same string into `mainTopic`, so the extra step collected
   * nothing the field below does not.
   */
  const handleStart = async (topic: string, format: DocFormat) => {
    // The round trip to the database is not instant. Without this guard the
    // button looks dead for the length of it and a second submit creates a
    // second project — which is what "the create button doesn't work" was.
    if (isCreating) return;

    setIsCreating(true);
    try {
      const plan = await createDocument(topic, format);
      // Not awaited: the editor does not read this list, so making the
      // navigation wait for a refetch only delays it.
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      // Straight into writing — naming a topic is a statement of intent to
      // write, and it is the one case where skipping the reading view is right.
      navigate(documentRoute(plan.id, plan.mainTopic, 'write'));
    } catch {
      toast.error('Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  /*
   * One action, not two.
   *
   * A card used to offer "Read" and "Edit" as separate destinations, and the
   * reading one was a modal — a document you could not link to, could not
   * reload back into, and could not hand to anybody. You open a project; what
   * you can do with it once it is open is a property of the project and you,
   * not a choice made from a button on a card.
   */
  const openDocument = useCallback((id: number) => {
    const plan = projects.find(p => p.id === id);
    navigate(documentRoute(id, plan?.mainTopic));
  }, [navigate, projects]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteLessonPlan(deleteId);
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      toast.success('Project deleted');
    } catch { toast.error('Failed to delete'); }
    finally { setIsDeleting(false); setDeleteId(null); }
  };

  /* Asked first, done second. The username check happens here, before the
     dialog, so a writer who cannot publish yet is told why instead of being
     asked to confirm something that will then fail. */
  const askPublish = (plan: LessonPlanResponse, next: boolean) => {
    if (next && !user?.username) {
      toast.error('Set a username in your Profile before making projects public.');
      return;
    }
    setPublishAsk({ plan, next });
  };

  const togglePublic = async (plan: LessonPlanResponse, toPublic: boolean) => {
    setPublishingId(plan.id);
    try {
      /* `coAuthors` is sent explicitly. The server no longer clears a field a
         PUT leaves out — it used to, and this call omitted it, so publishing a
         project deleted every collaborator on it. Stating it here means the
         request says what it means rather than relying on the server to infer
         it from silence. */
      await saveLessonPlan({
        id: plan.id,
        name: plan.name,
        mainTopic: plan.mainTopic,
        topics: plan.topics,
        coAuthors: plan.coAuthors ?? [],
        isPublic: toPublic,
      });
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      // The community's list is a different cache key, and publishing changes
      // what belongs in it. Without this the library kept serving whatever it
      // had — a document you just published was missing from it, and one you
      // just withdrew was still there, until the cache happened to expire.
      queryClient.invalidateQueries({ queryKey: ['public-lesson-plans'] });
      toast.success(toPublic ? 'Published to the community' : 'Removed from the community');
      // Only on success. A failed publish leaves the dialog up with the error
      // beside it, so the answer to "did that work?" is on screen and the
      // retry is one click away rather than four.
      setPublishAsk(null);
    } catch {
      toast.error(toPublic ? 'Could not publish this project' : 'Could not unpublish this project');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <Page className="relative z-10">
      <div>

        {/* The greeting is the small thing and the question is the large one.
            It used to be the other way round: "Workspace" in display type over
            a line of pleasantries, then four statistics at 24px, and only
            after all of that the controls that actually start work. */}
        <PageHeader
          className="page-head--tight"
          kicker={`${greeting}, ${user?.given_name || 'there'}.`}
          title="What are you writing about?"
        />

        <TopicStarter onStart={handleStart} busy={isCreating} />

        {/* One quiet line, not a four-cell scoreboard. The facts are worth
            having and none of them is worth 24px of numeral on a page whose
            job is to start the next document. */}
        {projects.length > 0 && (
          <p className="workspace-facts">
            <span><b>{projects.length}</b> document{projects.length === 1 ? '' : 's'}</span>
            <span><b>{totalWords.toLocaleString()}</b> words</span>
            <span><b>{publicCount}</b> published</span>
            {lastEdited && <span>last edited {formatDate(lastEdited)}</span>}
          </p>
        )}

        {/* ── Documents ── */}
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <span className="flex items-center gap-3">
              <h2 className="section-title" style={{ fontSize: 'var(--text-lg)' }}>Your documents</h2>
              <Refreshing active={isFetching && !isLoading} />
            </span>
            <div className="flex items-center gap-2.5">
              {projects.length > 0 && (
                <SearchField
                  className="w-52"
                  placeholder="Search documents…"
                  aria-label="Search documents"
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  clearOnEscape
                />
              )}
              <Segmented
                aria-label="View mode"
                iconOnly
                value={view}
                onChange={setView}
                options={[
                  { value: 'grid', label: 'Grid', icon: <LayoutGrid className="h-3.5 w-3.5" />, title: 'Grid view', 'aria-label': 'Grid view' },
                  { value: 'list', label: 'List', icon: <List className="h-3.5 w-3.5" />, title: 'List view', 'aria-label': 'List view' },
                ]}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="doc-card">
                  <Skeleton height={132} radius="none" />
                  <div className="doc-body">
                    <Skeleton height={16} width="75%" className="mb-2.5" />
                    <Skeleton height={12} width="50%" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            view === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(plan => (
                  <DocumentCard
                    key={plan.id}
                    doc={plan}
                    isAuthor={user?.id === plan.userId}
                    onOpen={openDocument}
                    onDelete={setDeleteId}
                    formatDate={formatDate}
                  >
                    <VisibilityChip
                      isPublic={!!plan.isPublic}
                      canChange={user?.id === plan.userId}
                      busy={publishingId === plan.id}
                      name={plan.name}
                      onChange={next => askPublish(plan, next)}
                    />
                  </DocumentCard>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(plan => (
                  <DocumentRow
                    key={plan.id}
                    doc={plan}
                    isAuthor={user?.id === plan.userId}
                    onOpen={openDocument}
                    onDelete={setDeleteId}
                    formatDate={formatDate}
                  >
                    <VisibilityChip
                      isPublic={!!plan.isPublic}
                      canChange={user?.id === plan.userId}
                      busy={publishingId === plan.id}
                      name={plan.name}
                      onChange={next => askPublish(plan, next)}
                    />
                  </DocumentRow>
                ))}
              </div>
            )
          ) : (
            <EmptyState
              icon={FolderOpen}
              title={searchQuery ? `No projects matching “${searchQuery}”` : 'No projects yet'}
              description={searchQuery
                ? 'Try a different search term.'
                : 'Start a blank document and let AI draft the sections for you.'}
              action={!searchQuery && (
                <Button variant="primary" size="lg" onClick={() => document.getElementById('workspace-topic')?.focus()}>
                  <Plus className="h-3.5 w-3.5" /> Name a topic
                </Button>
              )}
            />
          )}
        </div>
      </div>

      {/* ── Publish / unpublish confirmation ──
          Both directions are confirmed, and the copy differs because the two
          consequences differ: publishing exposes the document to everyone,
          unpublishing breaks links people may already be holding. */}
      {/* Not dismissable mid-request: the write is already on its way, and
          closing would leave the card showing a state nothing had confirmed. */}
      <ConfirmDialog
        open={!!publishAsk}
        onOpenChange={open => { if (!open) setPublishAsk(null); }}
        title={publishAsk?.next ? 'Publish to the community?' : 'Remove from the community?'}
        description={publishAsk?.next
          ? <>“{publishAsk.plan.name}” will be listed in the community library, and anyone — signed in or not — will be able to open and read it. You can undo this at any time.</>
          : <>“{publishAsk?.plan.name}” will be delisted, and anyone holding a link to it will stop being able to open it. Your collaborators keep their access.</>}
        confirmLabel={publishAsk?.next ? 'Publish' : 'Unpublish'}
        busyLabel={publishAsk?.next ? 'Publishing…' : 'Unpublishing…'}
        busy={publishingId !== null}
        onConfirm={() => publishAsk && togglePublic(publishAsk.plan, publishAsk.next)}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={open => { if (!open) setDeleteId(null); }}
        title="Delete project?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        busyLabel="Deleting..."
        tone="danger"
        busy={isDeleting}
        onConfirm={handleDelete}
      />



    </Page>
  );
}
