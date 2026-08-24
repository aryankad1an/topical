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
import {
  FileType2, FileCode2, Plus, Loader2, Search, FolderOpen, X, LayoutGrid, List,
} from 'lucide-react';
import { DocumentCard, DocumentRow, wordCount } from '@/components/projects/DocumentCard';
import { PageHeader, StatStrip, EmptyState, PillToggle } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute('/_authenticated/projects')({ component: ProjectsPage });

function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showNameDialog, setShowNameDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState<DocFormat>('mdx');
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

  const openCreateDialog = (type: DocFormat) => {
    setProjectType(type);
    setProjectName('');
    setShowNameDialog(true);
  };

  const handleCreate = async () => {
    const name = projectName.trim();
    if (!name) { toast.error('Please enter a project name'); return; }
    try {
      const mainTopic = projectType === 'latex' ? `${LATEX_PREFIX}${name}` : name;
      const result = await saveLessonPlan({ name, mainTopic, topics: [] });
      if ('error' in result) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      setShowNameDialog(false);
      navigate({ to: '/editor', search: { id: result.id, type: projectType } });
      toast.success(`Project "${name}" created`);
    } catch {
      toast.error('Failed to create project');
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
    <div className="flex flex-col min-h-screen w-full py-8" style={{ paddingInline: 'var(--gutter)' }}>
      <div className="mx-auto w-full relative z-10" style={{ maxWidth: '72rem' }}>

        {/* ── Header ── */}
        <PageHeader
          className="mb-7"
          title="Workspace"
          subtitle={`${greeting}, ${user?.given_name || 'there'}. ${projects.length
            ? `You have ${projects.length} document${projects.length === 1 ? '' : 's'}.`
            : 'Start your first document below.'}`}
          actions={
            <button onClick={() => openCreateDialog('mdx')}
              className="accent-btn inline-flex items-center gap-2 h-10 px-5 rounded-full text-sm">
              <Plus className="h-4 w-4" /> New document
            </button>
          }
        />

        {/* ── Stats ── */}
        <StatStrip className="mb-7" items={[
          { label: 'Documents', value: projects.length },
          { label: 'Words written', value: totalWords.toLocaleString() },
          { label: 'Published', value: publicCount },
          { label: 'Last edited', value: lastEdited ? formatDate(lastEdited) : '—', small: true },
        ]} />

        {/* ── Start something ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
          <button className="new-tile" onClick={() => openCreateDialog('mdx')}>
            <span className="new-tile-icon">
              <FileType2 className="h-4 w-4" style={{ color: 'var(--accent-500)' }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink)]">Blank MDX document</span>
              <span className="block text-[12px] text-[var(--ink-faint)] mt-0.5">Interactive, with AI generation and live preview</span>
            </span>
            <Plus className="h-4 w-4 text-[var(--ink-ghost)] shrink-0" />
          </button>

          <button className="new-tile" onClick={() => openCreateDialog('latex')}
            style={{ ['--tile-accent-soft' as string]: 'var(--latex-soft)', ['--tile-accent-line' as string]: 'var(--latex-500)' }}>
            <span className="new-tile-icon">
              <FileCode2 className="h-4 w-4" style={{ color: 'var(--latex-500)' }} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-[var(--ink)]">Blank LaTeX document</span>
              <span className="block text-[12px] text-[var(--ink-faint)] mt-0.5">For mathematical and scientific writing</span>
            </span>
            <Plus className="h-4 w-4 text-[var(--ink-ghost)] shrink-0" />
          </button>
        </div>

        {/* ── Documents ── */}
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <PageHeader level="section" title="Your documents" className="mb-0" />
            <div className="flex items-center gap-2.5">
              {projects.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-ghost)]" />
                  <input type="text" placeholder="Search…" value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="glass-input h-9 pl-9 pr-3 text-sm" style={{ width: 180 }} />
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
                <button onClick={() => openCreateDialog('mdx')}
                  className="accent-btn inline-flex items-center gap-2 h-9 px-5 rounded-full text-xs">
                  <Plus className="h-3.5 w-3.5" /> New MDX project
                </button>
              )}
            />
          )}
        </div>
      </div>

      {/* Create Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-[var(--ink)]">Name your project</DialogTitle>
            <DialogDescription className="text-[var(--ink-faint)]">Give your {projectType === 'mdx' ? 'MDX' : 'LaTeX'} project a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="e.g. Machine Learning Fundamentals" value={projectName}
              onChange={e => setProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              className="glass-input" autoFocus />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNameDialog(false)} className="glass-btn border-[var(--line)]">Cancel</Button>
            <Button onClick={handleCreate} className="text-[var(--accent-ink)] font-semibold"
              style={{ background: 'var(--accent-400)' }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
