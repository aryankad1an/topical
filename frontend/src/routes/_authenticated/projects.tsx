import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { getLessonPlans, deleteLessonPlan, saveLessonPlan, getLessonPlanById, LessonPlanResponse } from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { MDXRenderer } from '@/components/mdxRenderer';
import {
  FileType2, FileCode2, Plus, Calendar, Trash2, Loader2, Search, Globe, Lock, FolderOpen, Eye, X, ArrowLeft,
} from 'lucide-react';
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
  const [projectType, setProjectType] = useState<'mdx' | 'latex'>('mdx');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Public toggle confirmation
  const [publicConfirm, setPublicConfirm] = useState<{ plan: LessonPlanResponse; toPublic: boolean } | null>(null);

  // Read modal
  const [readProject, setReadProject] = useState<{ name: string; content: string; type: 'mdx' | 'latex' } | null>(null);
  const [isLoadingRead, setIsLoadingRead] = useState(false);

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['user-lesson-plans'],
    queryFn: getLessonPlans,
    enabled: !!user,
  });

  const projects = projectsData?.lessonPlans || [];
  const filtered = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getType = (p: { mainTopic: string }): 'mdx' | 'latex' => p.mainTopic.startsWith('latex:') ? 'latex' : 'mdx';

  const openCreateDialog = (type: 'mdx' | 'latex') => {
    setProjectType(type);
    setProjectName('');
    setShowNameDialog(true);
  };

  const handleCreate = async () => {
    const name = projectName.trim();
    if (!name) { toast.error('Please enter a project name'); return; }
    try {
      const mainTopic = projectType === 'latex' ? `latex:${name}` : name;
      const result = await saveLessonPlan({ name, mainTopic, topics: [] });
      if ('error' in result) throw new Error(result.error);
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      setShowNameDialog(false);
      navigate({ to: '/editor', search: { id: result.id, type: projectType } } as any);
      toast.success(`Project "${name}" created`);
    } catch {
      toast.error('Failed to create project');
    }
  };

  const handleView = (id: number) => {
    const plan = projects.find(p => p.id === id);
    const type = plan ? getType(plan) : 'mdx';
    navigate({ to: '/editor', search: { id, type } } as any);
  };

  const handleRead = async (id: number) => {
    setIsLoadingRead(true);
    try {
      const res = await getLessonPlanById(id);
      if ('error' in res) throw new Error(res.error);
      const combined = res.topics.filter(t => t.mdxContent?.trim()).map(t => stripFrontmatter(t.mdxContent)).join('\n\n---\n\n');
      setReadProject({ name: res.name, content: combined, type: getType(res) });
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

  const confirmTogglePublic = (plan: LessonPlanResponse, toPublic: boolean) => {
    if (toPublic && !user?.username) {
      toast.error('Set a username in your Profile before making projects public.');
      return;
    }
    setPublicConfirm({ plan, toPublic });
  };

  const executeTogglePublic = async () => {
    if (!publicConfirm) return;
    const { plan, toPublic } = publicConfirm;
    try {
      await saveLessonPlan({ id: plan.id, name: plan.name, mainTopic: plan.mainTopic, topics: plan.topics, isPublic: toPublic });
      queryClient.invalidateQueries({ queryKey: ['user-lesson-plans'] });
      toast.success(toPublic ? 'Project is now public' : 'Project is now private');
    } catch { toast.error('Failed to update'); }
    finally { setPublicConfirm(null); }
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  const dialogStyle = { background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' };

  return (
    <div className="flex flex-col min-h-screen w-full py-8 px-4">
      <div className="container mx-auto max-w-5xl relative z-10">
        <div className="mb-10">
          <h1 className="font-brand text-4xl md:text-5xl tracking-tight mb-3 gradient-text">Projects</h1>
          <p className="text-white/40 text-lg">Create and manage your documents.</p>
        </div>

        {/* Create Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          <div className="glass-card liquid-glow p-7 group cursor-pointer hover:-translate-y-1 transition-all duration-300"
            onClick={() => openCreateDialog('mdx')}>
            <div className="flex items-start justify-between mb-5">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <FileType2 className="h-5 w-5" style={{ color: '#22c55e' }} />
              </div>
              <div className="h-7 w-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Plus className="h-3.5 w-3.5 text-white/70" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white/90 mb-2">Blank MDX Project</h3>
            <p className="text-white/40 text-sm leading-relaxed mb-5">Interactive document with AI generation and smart refinement.</p>
            <div className="text-sm font-medium" style={{ color: '#22c55e' }}>Create project &rarr;</div>
          </div>

          <div className="glass-card p-7 group cursor-pointer hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            onClick={() => openCreateDialog('latex')}>
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-start justify-between mb-5 relative z-10">
              <div className="h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <FileCode2 className="h-5 w-5 text-blue-400" />
              </div>
              <div className="h-7 w-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Plus className="h-3.5 w-3.5 text-white/70" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-white/90 mb-2 relative z-10">Blank LaTeX Project</h3>
            <p className="text-white/40 text-sm leading-relaxed mb-5 relative z-10">Professional document for mathematical or scientific writing.</p>
            <div className="text-sm font-medium text-blue-400 relative z-10">Create project &rarr;</div>
          </div>
        </div>

        {/* My Projects */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-white/80">My Projects</h2>
            <span className="text-xs text-white/30">{projects.length} total</span>
          </div>

          {projects.length > 0 && (
            <div className="relative mb-5 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input type="text" placeholder="Search projects..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="glass-input w-full h-10 pl-10 pr-4 text-sm" />
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card p-5 animate-pulse">
                  <div className="h-4 bg-white/[0.04] rounded w-3/4 mb-3" />
                  <div className="h-3 bg-white/[0.03] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(plan => {
                const type = getType(plan);
                return (
                  <div key={plan.id} className="glass-card p-5 group flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: type === 'latex' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: type === 'latex' ? '#60a5fa' : '#22c55e' }}>
                            {type === 'latex' ? 'LaTeX' : 'MDX'}
                          </span>
                          <h3 className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors leading-tight truncate">
                            {plan.name}
                          </h3>
                        </div>
                        {/* Public toggle */}
                        <button onClick={() => confirmTogglePublic(plan as LessonPlanResponse, !plan.isPublic)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors shrink-0"
                          style={plan.isPublic
                            ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' }
                            : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)' }}>
                          {plan.isPublic ? <><Globe className="h-2.5 w-2.5" /> Public</> : <><Lock className="h-2.5 w-2.5" /> Private</>}
                        </button>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-white/25 mb-3">
                        <Calendar className="h-2.5 w-2.5" />
                        <span>{formatDate(plan.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <button onClick={() => handleRead(plan.id)}
                        className="glass-btn flex-1 h-8 text-xs font-medium flex items-center justify-center gap-1.5">
                        <Eye className="h-3 w-3" /> Read
                      </button>
                      <button onClick={() => handleView(plan.id)}
                        className="flex-1 h-8 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 text-black transition-all hover:scale-[1.02]"
                        style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>Edit</button>
                      <button onClick={() => setDeleteId(plan.id)}
                        className="glass-btn h-8 w-8 flex items-center justify-center text-red-400/60 hover:text-red-400">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <FolderOpen className="h-10 w-10 mx-auto mb-4 text-white/10" />
              <p className="text-white/30 text-sm">{searchQuery ? `No projects matching "${searchQuery}"` : 'No projects yet. Create one above!'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-white/90">Name your project</DialogTitle>
            <DialogDescription className="text-white/40">Give your {projectType === 'mdx' ? 'MDX' : 'LaTeX'} project a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="e.g. Machine Learning Fundamentals" value={projectName}
              onChange={e => setProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              className="glass-input" autoFocus />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNameDialog(false)} className="glass-btn border-white/10">Cancel</Button>
            <Button onClick={handleCreate} className="text-black font-semibold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-md" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-white/90">Delete project?</DialogTitle>
            <DialogDescription className="text-white/40">This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting} className="glass-btn border-white/10">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public Toggle Confirmation */}
      <Dialog open={!!publicConfirm} onOpenChange={() => setPublicConfirm(null)}>
        <DialogContent className="sm:max-w-md" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-white/90">{publicConfirm?.toPublic ? 'Make project public?' : 'Make project private?'}</DialogTitle>
            <DialogDescription className="text-white/40">
              {publicConfirm?.toPublic
                ? 'This project will be visible to everyone in the community.'
                : 'This project will only be visible to you.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPublicConfirm(null)} className="glass-btn border-white/10">Cancel</Button>
            <Button onClick={executeTogglePublic} className="text-black font-semibold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>
              {publicConfirm?.toPublic ? 'Publish' : 'Make Private'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read Modal */}
      <Dialog open={!!readProject} onOpenChange={() => setReadProject(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" style={{
          ...dialogStyle, padding: 0, width: '90vw',
        }}>
          <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: readProject?.type === 'latex' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: readProject?.type === 'latex' ? '#60a5fa' : '#22c55e' }}>
                {readProject?.type === 'latex' ? 'LaTeX' : 'MDX'}
              </span>
              <h3 className="text-sm font-semibold text-white/80">{readProject?.name}</h3>
            </div>
            <button onClick={() => setReadProject(null)} className="text-white/40 hover:text-white/70"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-auto px-6 py-5">
            {readProject?.content ? (
              readProject.type === 'latex'
                ? <pre className="text-white/70 text-sm whitespace-pre-wrap font-mono leading-relaxed">{readProject.content}</pre>
                : <div className="prose dark:prose-invert max-w-none"><MDXRenderer content={readProject.content} /></div>
            ) : (
              <div className="text-center py-16 text-white/20">
                <p className="text-sm">This project has no content yet.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading overlay for read */}
      {isLoadingRead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#22c55e' }} />
        </div>
      )}
    </div>
  );
}
