/**
 * The projects workspace: the documents you own or co-author.
 *
 * A project's format is carried in its `mainTopic` (a `latex:` prefix), not a
 * separate column, so `formatOf` in `@/lib/types` is the single place that
 * decides — see the note there.
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getLessonPlans, deleteLessonPlan, saveLessonPlan, getLessonPlanById, LessonPlanResponse } from '@/lib/api';
import { documentContent } from '@/lib/documents';
import { formatDate } from '@/lib/format';
import { formatOf, LATEX_PREFIX, type DocFormat } from '@/lib/types';
import { MarkdownPreview } from '@/features/preview/MarkdownPreview';
import { LatexPreview } from '@/features/preview/LatexPreview';
import { Plus, Loader2, Search, FolderOpen, X, LayoutGrid, List } from 'lucide-react';
import { TopicStarter } from '@/components/projects/TopicStarter';
import { DocumentCard, DocumentRow, wordCount } from '@/components/projects/DocumentCard';
import { EmptyState, PillToggle, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute('/_authenticated/projects')({ component: ProjectsPage });

function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');



  // Read modal
  const [readProject, setReadProject] = useState<{ name: string; content: string; type: DocFormat } | null>(null);
  const [isLoadingRead, setIsLoadingRead] = useState(false);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['user-lesson-plans'],
    queryFn: getLessonPlans,
    enabled: !!user,
  });

  const projects = projectsData?.lessonPlans || [];
  const filtered = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Workspace stats — a document count alone said little about the work itself.
  const totalWords = projects.reduce((n, p) => n + wordCount(p), 0);
  const publicCount = projects.filter(p => p.isPublic).length;
  const editDates = projects
    .map(p => p.updatedAt ?? p.createdAt)
    .filter((d): d is string => !!d)
    .sort();
  const lastEdited = editDates.length ? editDates[editDates.length - 1] : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

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
      const mainTopic = format === 'latex' ? `${LATEX_PREFIX}${topic}` : topic;
      const result = await saveLessonPlan({ name: topic, mainTopic, topics: [] });
      // Not awaited: the editor does not read this list, so making the
      // navigation wait for a refetch only delays it.
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      navigate({ to: '/editor', search: { id: result.id, type: format } });
    } catch {
      toast.error('Failed to create project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleView = (id: number) => {
    const plan = projects.find(p => p.id === id);
    const type = formatOf(plan?.mainTopic);
    navigate({ to: '/editor', search: { id, type } });
  };

  const handleRead = async (id: number) => {
    setIsLoadingRead(true);
    try {
      const res = await getLessonPlanById(id);
      if ('error' in res) throw new Error(res.error);
      setReadProject({ name: res.name, content: documentContent(res.topics), type: formatOf(res.mainTopic) });
    } catch {
      toast.error('Failed to load project');
    } finally {
      setIsLoadingRead(false);
    }
  };

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

  const togglePublic = async (plan: LessonPlanResponse, toPublic: boolean) => {
    if (toPublic && !user?.username) {
      toast.error('Set a username in your Profile before making projects public.');
      return;
    }
    try {
      await saveLessonPlan({ id: plan.id, name: plan.name, mainTopic: plan.mainTopic, topics: plan.topics, isPublic: toPublic });
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      toast.success(toPublic ? 'Project is now public' : 'Project is now private');
    } catch { toast.error('Failed to update'); }
  };

  const dialogStyle = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '16px' };

  return (
    <div className="page-shell relative z-10">
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
            <h2 className="section-title" style={{ fontSize: 'var(--text-lg)' }}>Your documents</h2>
            <div className="flex items-center gap-2.5">
              {projects.length > 0 && (
                <div className="search-field" style={{ width: 200 }}>
                  <Search className="search-field-icon" />
                  <input type="text" placeholder="Search documents…" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
                    aria-label="Search documents"
                    className={`glass-input search-input${searchQuery ? ' search-input--clearable' : ''}`} />
                  {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div className="segmented" role="group" aria-label="View mode">
                <button data-active={view === 'grid'} onClick={() => setView('grid')} aria-label="Grid view" title="Grid view">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button data-active={view === 'list'} onClick={() => setView('list')} aria-label="List view" title="List view">
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="doc-card">
                  <div className="skeleton" style={{ height: 132, borderRadius: 0 }} />
                  <div className="doc-body">
                    <div className="skeleton h-4 w-3/4 mb-2.5" />
                    <div className="skeleton h-3 w-1/2" />
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
                    onRead={handleRead}
                    onEdit={handleView}
                    onDelete={setDeleteId}
                    formatDate={formatDate}
                  >
                    {user?.id === plan.userId && (
                      <PillToggle
                        checked={!!plan.isPublic}
                        label={`Publish "${plan.name}" to the community`}
                        onChange={next => togglePublic(plan as LessonPlanResponse, next)}
                      />
                    )}
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
                    onRead={handleRead}
                    onEdit={handleView}
                    onDelete={setDeleteId}
                    formatDate={formatDate}
                  />
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
                <button
                  onClick={() => document.getElementById('workspace-topic')?.focus()}
                  className="accent-btn inline-flex items-center gap-2 h-9 px-5 rounded-full text-xs">
                  <Plus className="h-3.5 w-3.5" /> Name a topic
                </button>
              )}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-md" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-[var(--ink)]">Delete project?</DialogTitle>
            <DialogDescription className="text-[var(--ink-faint)]">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting} className="glass-btn border-[var(--line)]">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Read Modal */}
      <Dialog open={!!readProject} onOpenChange={() => setReadProject(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" style={{
          ...dialogStyle, padding: 0, width: '90vw',
        }}>
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--line-soft)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: readProject?.type === 'latex' ? 'var(--latex-soft)' : 'var(--accent-soft)', color: readProject?.type === 'latex' ? 'var(--latex-500)' : 'var(--accent-500)' }}>
                {readProject?.type === 'latex' ? 'LaTeX' : 'MDX'}
              </span>
              <h3 className="text-sm font-semibold text-[var(--ink-2)]">{readProject?.name}</h3>
            </div>
            <button onClick={() => setReadProject(null)} className="text-[var(--ink-faint)] hover:text-[var(--ink-2)]"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-auto px-6 py-5">
            {readProject?.content ? (
              // Rendered, not raw: LaTeX used to be dumped here as source.
              readProject.type === 'latex'
                ? <LatexPreview content={readProject.content} showIssues={false} />
                : <MarkdownPreview content={readProject.content} />
            ) : (
              <div className="text-center py-16 text-[var(--ink-ghost)]">
                <p className="text-sm">This project has no content yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading overlay for read */}
      {isLoadingRead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--surface)' }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--accent-500)' }} />
        </div>
      )}
    </div>
  );
}
