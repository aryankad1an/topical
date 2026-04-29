import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { saveLessonPlan, getLessonPlanById } from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { MDXRenderer } from '@/components/mdxRenderer';
import { LaTeXRenderer } from '@/components/editor/LaTeXRenderer';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { AIContentDialog } from '@/components/editor/AIContentDialog';
import { Save, Eye, SplitSquareHorizontal, FileCode, Loader2, ArrowLeft, Undo2, Redo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/editor')({ component: ProjectEditor });

/* ── Undo/Redo history ── */
function useHistory(initial: string) {
  const [stack, setStack] = useState([initial]);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const current = stack[idx];

  const push = useCallback((val: string) => {
    // Debounce: group rapid keystrokes into one snapshot
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStack(prev => {
        const newStack = prev.slice(0, idx + 1);
        newStack.push(val);
        // Keep max 100 snapshots
        if (newStack.length > 100) newStack.shift();
        return newStack;
      });
      setIdx(prev => Math.min(prev + 1, 99));
    }, 400);
  }, [idx]);

  const undo = useCallback(() => {
    setIdx(prev => Math.max(0, prev - 1));
  }, []);

  const redo = useCallback(() => {
    setIdx(prev => Math.min(stack.length - 1, prev + 1));
  }, [stack.length]);

  const canUndo = idx > 0;
  const canRedo = idx < stack.length - 1;

  // Force-set without history (for initial load)
  const reset = useCallback((val: string) => {
    setStack([val]);
    setIdx(0);
  }, []);

  return { current, push, undo, redo, canUndo, canRedo, reset };
}

function ProjectEditor() {
  const navigate = useNavigate();

  const [projectId, setProjectId] = useState<number | undefined>();
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectType, setProjectType] = useState<'mdx' | 'latex'>('mdx');
  const history = useHistory('');
  const content = history.current;
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('split');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Load project
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const type = params.get('type');
    if (type === 'latex') setProjectType('latex');
    if (id) loadProject(Number(id));
    else setIsLoading(false);
  }, []);

  const loadProject = async (id: number) => {
    setIsLoading(true);
    try {
      const res = await getLessonPlanById(id);
      if ('error' in res) throw new Error(res.error);
      const combined = res.topics.filter(t => t.mdxContent?.trim()).map(t => stripFrontmatter(t.mdxContent)).join('\n\n---\n\n');
      setProjectId(res.id);
      setProjectName(res.name);
      if (res.mainTopic.startsWith('latex:')) setProjectType('latex');
      history.reset(combined);
    } catch { toast.error('Failed to load project'); }
    finally { setIsLoading(false); }
  };

  const setContent = useCallback((val: string) => {
    history.push(val);
    setIsDirty(true);
  }, [history]);

  // Save
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const mainTopic = projectType === 'latex' ? `latex:${projectName}` : projectName;
      const plan = { id: projectId, name: projectName, mainTopic, topics: [{ topic: projectName, mdxContent: content, isSubtopic: false, parentTopic: projectName, mainTopic }] };
      const result = await saveLessonPlan(plan);
      if ('error' in result) throw new Error(result.error);
      setProjectId(result.id);
      setIsDirty(false);
      toast.success('Saved');
    } catch { toast.error('Failed to save'); }
    finally { setIsSaving(false); }
  }, [content, projectId, projectName, projectType]);

  // Image
  const handleImageUpload = () => { setImageUrl(''); setShowImageDialog(true); };
  const insertImageFromUrl = () => {
    if (!imageUrl.trim()) return;
    const ta = editorRef.current;
    const pos = ta ? ta.selectionStart : content.length;
    const imgStr = projectType === 'latex'
      ? `\n\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${imageUrl}}\n\\end{figure}\n`
      : `\n![image](${imageUrl})\n`;
    setContent(content.substring(0, pos) + imgStr + content.substring(pos));
    setShowImageDialog(false);
  };
  const handleBrowseUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch('/api/files/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const { url } = await res.json() as { url: string };
      setImageUrl(url);
      toast.success('Uploaded');
    } catch { toast.error('Upload failed'); }
    finally { setIsUploading(false); }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') { e.preventDefault(); handleSave(); }
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); }
      if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); history.redo(); }
      if (mod && e.key === 'y') { e.preventDefault(); history.redo(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [handleSave, history]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen" style={{ background: '#0a0a0a' }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: '#22c55e' }} /></div>;
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* ═══ Top Bar ═══ */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate({ to: '/projects' } as any)}
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <input className="bg-transparent border-none outline-none text-white/80 font-semibold text-sm px-2 py-1 rounded-md hover:bg-white/[0.03] focus:bg-white/[0.05] transition-colors min-w-0 flex-shrink"
          value={projectName} onChange={e => { setProjectName(e.target.value); setIsDirty(true); }} />
        <div className="flex-1" />

        {/* Undo / Redo */}
        <button onClick={history.undo} disabled={!history.canUndo} title="Undo (⌘Z)"
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={history.redo} disabled={!history.canRedo} title="Redo (⌘⇧Z)"
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 disabled:opacity-20 transition-colors">
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* View mode */}
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          {([
            { mode: 'code' as const, icon: FileCode, label: 'Code' },
            { mode: 'split' as const, icon: SplitSquareHorizontal, label: 'Split' },
            { mode: 'preview' as const, icon: Eye, label: 'Preview' },
          ]).map(v => (
            <button key={v.mode} onClick={() => setViewMode(v.mode)}
              className={`px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors ${viewMode === v.mode ? 'text-white/80' : 'text-white/25 hover:text-white/50'}`}
              style={viewMode === v.mode ? { background: 'rgba(255,255,255,0.04)' } : {}}>
              <v.icon className="h-3 w-3" />{v.label}
            </button>
          ))}
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={isSaving}
          className="h-7 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1 text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {isSaving ? 'Saving' : isDirty ? 'Save*' : 'Saved'}
        </button>
      </div>

      {/* ═══ Toolbar ═══ */}
      <EditorToolbar editorRef={editorRef} content={content} setContent={setContent} setIsDirty={setIsDirty}
        projectType={projectType} onOpenAI={() => setShowAI(true)} onImageUpload={handleImageUpload} />

      {/* ═══ Editor + Preview ═══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {viewMode !== 'preview' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full flex flex-col`}
            style={viewMode === 'split' ? { borderRight: '1px solid rgba(255,255,255,0.06)' } : {}}>
            <textarea ref={editorRef}
              className="flex-1 w-full border-none resize-none font-mono focus:ring-0 focus:outline-none bg-transparent text-white/80 placeholder-white/15"
              value={content} onChange={e => setContent(e.target.value)}
              placeholder={projectType === 'latex' ? '% Start typing LaTeX here...' : 'Start typing your document here...'}
              style={{ fontSize: '13px', lineHeight: '1.7', padding: '1rem 1.25rem', tabSize: 2 }} />
          </div>
        )}
        {viewMode !== 'code' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-auto`} style={{ padding: '1rem 1.25rem' }}>
            {content.trim() ? (
              projectType === 'latex'
                ? <LaTeXRenderer content={content} />
                : <div className="prose dark:prose-invert w-full max-w-none"><MDXRenderer content={content} /></div>
            ) : (
              <div className="text-center py-20 text-white/15">
                <Eye className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Preview appears here as you type</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI Dialog */}
      <AIContentDialog open={showAI} onOpenChange={setShowAI} projectType={projectType}
        projectName={projectName} content={content} setContent={setContent} setIsDirty={setIsDirty} />

      {/* Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-md" style={{ background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }}>
          <DialogHeader>
            <DialogTitle className="text-white/90 text-sm">Insert Image</DialogTitle>
            <DialogDescription className="text-white/40 text-xs">Upload from device or paste a URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Browse from device</label>
              <input type="file" accept="image/*" className="text-xs text-white/60"
                onChange={e => { if (e.target.files?.[0]) handleBrowseUpload(e.target.files[0]); }} />
              {isUploading && <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40"><Loader2 className="h-3 w-3 animate-spin" /> Uploading...</div>}
            </div>
            <div>
              <label className="text-[11px] text-white/50 mb-1 block">Or paste image URL</label>
              <Input placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="glass-input text-xs" />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-3">
            <Button variant="outline" onClick={() => setShowImageDialog(false)} className="glass-btn border-white/10 text-xs h-8">Cancel</Button>
            <Button onClick={insertImageFromUrl} disabled={!imageUrl.trim()} className="text-black font-semibold text-xs h-8"
              style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
