import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { saveLessonPlan, getLessonPlanById, searchUsername } from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { MDXRenderer } from '@/components/mdxRenderer';
import { LaTeXRenderer } from '@/components/editor/LaTeXRenderer';
import { EditorToolbar } from '@/components/editor/EditorToolbar';
import { AIContentPanel } from '@/components/editor/AIContentDialog';
import { useAuth } from '@/lib/auth-context';
import { useYjsCollab } from '@/hooks/useYjsCollab';
import { PeerCursors } from '@/components/editor/PeerCursors';
import { Save, Eye, SplitSquareHorizontal, FileCode, Loader2, ArrowLeft, Undo2, Redo2, Users, Search as SearchIcon, UserPlus, X, Wifi, WifiOff, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/editor')({ component: ProjectEditor });

function ProjectEditor() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUsername = user?.username || user?.given_name || 'Anonymous';

  const [projectId, setProjectId] = useState<number | undefined>();
  const [projectName, setProjectName] = useState('Untitled Project');
  const [projectType, setProjectType] = useState<'mdx' | 'latex'>('mdx');
  const [content, setContentRaw] = useState('');
  const [authorUsername, setAuthorUsername] = useState<string | null>(null);
  const [coAuthors, setCoAuthors] = useState<string[]>([]);
  const [coAuthorUsernames, setCoAuthorUsernames] = useState<string[]>([]);
  const [showCoAuthorsDialog, setShowCoAuthorsDialog] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{id: string, username: string}[]>([]);
  const [viewMode, setViewMode] = useState<'code' | 'preview' | 'split'>('split');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Is the current user the project author? (author can manage co-authors)
  const isAuthor = !authorUsername || authorUsername === currentUsername;

  // Yjs collaboration
  const docIdStr = projectId ? String(projectId) : undefined;
  const { peers, connected, initContent, applyLocalChange, updateCursor, isRemoteUpdate } = useYjsCollab(
    docIdStr,
    currentUsername,
    // Called when remote peers change the document
    (remoteText: string) => {
      setContentRaw(remoteText);
    }
  );

  const setContent = useCallback((val: string) => {
    setContentRaw(val);
    setIsDirty(true);
    // Only push to Yjs if this is a local edit (not a remote update)
    if (!isRemoteUpdate.current) {
      applyLocalChange(val);
    }
  }, [applyLocalChange]);

  // Native undo/redo via execCommand (works with textarea)
  const handleUndo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('undo');
  }, []);

  const handleRedo = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand('redo');
  }, []);

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
      setAuthorUsername(res.authorUsername || null);
      setCoAuthors(res.coAuthors || []);
      setCoAuthorUsernames(res.coAuthorUsernames || []);
      if (res.mainTopic.startsWith('latex:')) setProjectType('latex');
      setContentRaw(combined);
      // Seed Yjs doc with initial content (will be ignored if already populated from WS)
      setTimeout(() => initContent(combined), 500);
    } catch { toast.error('Failed to load project'); }
    finally { setIsLoading(false); }
  };

  // Save
  const doSave = useCallback(async (silent = false) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const mainTopic = projectType === 'latex' ? `latex:${projectName}` : projectName;
      const plan = { id: projectId, name: projectName, mainTopic, topics: [{ topic: projectName, mdxContent: content, isSubtopic: false, parentTopic: projectName, mainTopic }], coAuthors };
      const result = await saveLessonPlan(plan);
      if ('error' in result) throw new Error(result.error);
      setProjectId(result.id);
      setIsDirty(false);
      if (!silent) toast.success('Saved');
    } catch { if (!silent) toast.error('Failed to save'); }
    finally { setIsSaving(false); }
  }, [content, projectId, projectName, projectType, isSaving, coAuthors]);

  // Autosave every 15s
  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty && !isSaving && projectId) doSave(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [isDirty, isSaving, projectId, doSave]);

  // Co-authors search
  useEffect(() => {
    if (searchUserQuery.length >= 2) {
      const delay = setTimeout(async () => {
        const results = await searchUsername(searchUserQuery);
        setUserSearchResults(results);
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setUserSearchResults([]);
    }
  }, [searchUserQuery]);

  const addCoAuthor = (userId: string, uname: string) => {
    if (!coAuthors.includes(userId)) {
      const newCoAuthors = [...coAuthors, userId];
      const newCoAuthorUsernames = [...coAuthorUsernames, uname];
      setCoAuthors(newCoAuthors);
      setCoAuthorUsernames(newCoAuthorUsernames);
      setIsDirty(true);
      toast.success(`Added ${uname} as co-author`);
      // Immediately persist co-author change
      saveCoAuthors(newCoAuthors);
    }
  };
  const removeCoAuthor = (userId: string) => {
    const idx = coAuthors.indexOf(userId);
    if (idx < 0) return;
    const removedName = coAuthorUsernames[idx] || userId;
    const newCoAuthors = coAuthors.filter(id => id !== userId);
    const newCoAuthorUsernames = coAuthorUsernames.filter((_, i) => i !== idx);
    setCoAuthors(newCoAuthors);
    setCoAuthorUsernames(newCoAuthorUsernames);
    setIsDirty(true);
    toast.success(`Removed ${removedName} as co-author`);
    // Immediately persist co-author change
    saveCoAuthors(newCoAuthors);
  };

  // Immediately save just the co-authors list without waiting for autosave
  const saveCoAuthors = async (newCoAuthors: string[]) => {
    if (!projectId) return;
    try {
      const mainTopic = projectType === 'latex' ? `latex:${projectName}` : projectName;
      const plan = { id: projectId, name: projectName, mainTopic, topics: [{ topic: projectName, mdxContent: content, isSubtopic: false, parentTopic: projectName, mainTopic }], coAuthors: newCoAuthors };
      await saveLessonPlan(plan);
      setIsDirty(false);
    } catch { toast.error('Failed to save co-author changes'); }
  };

  // Track cursor position for awareness — guarded against remote updates
  const handleEditorSelect = useCallback(() => {
    // Don't send cursor position during remote content changes.
    // The textarea cursor is unreliable during React re-renders.
    if (isRemoteUpdate.current) return;
    const ta = editorRef.current;
    if (!ta) return;
    updateCursor(ta.selectionStart, ta.selectionEnd - ta.selectionStart);
  }, [updateCursor]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); doSave(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [doSave]);



  if (isLoading) {
    return <div className="flex items-center justify-center h-screen" style={{ background: '#0a0a0a' }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: '#22c55e' }} /></div>;
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Top Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate({ to: '/projects' } as any)}
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <input className="bg-transparent border-none outline-none text-white/80 font-semibold text-sm px-2 py-1 rounded-md hover:bg-white/[0.03] focus:bg-white/[0.05] transition-colors min-w-0 flex-shrink"
          value={projectName} onChange={e => { setProjectName(e.target.value); setIsDirty(true); }} />
          
        {/* Author + Co-Authors section */}
        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
          <span className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Author:</span>
          <span className="text-xs text-white/60">{authorUsername || "You"}</span>
          {coAuthorUsernames.length > 0 && (
            <>
              <span className="text-white/10">|</span>
              <span className="text-[10px] text-white/25 uppercase tracking-wider font-semibold">Co:</span>
              <span className="text-xs text-white/45 truncate max-w-[120px]">{coAuthorUsernames.slice(0, 2).join(', ')}{coAuthorUsernames.length > 2 ? ` +${coAuthorUsernames.length - 2}` : ''}</span>
            </>
          )}
          {/* Only the author can manage co-authors */}
          {isAuthor && (
            <button onClick={() => setShowCoAuthorsDialog(true)}
              className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-[10px] text-white/40 hover:text-white/60">
              <Users className="h-3 w-3" /> Manage
            </button>
          )}
        </div>

        {/* Peer presence indicators */}
        {peers.length > 0 && (
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-white/10">
            {peers.map(p => (
              <div key={p.clientId} title={p.user.name} className="flex items-center gap-1">
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: p.user.color, boxShadow: `0 0 6px ${p.user.color}40` }}>
                  {p.user.name[0]?.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connection indicator */}
        <div className="ml-1" title={connected ? 'Connected' : 'Reconnecting...'}>
          {connected
            ? <Wifi className="h-3 w-3 text-green-500/60" />
            : <WifiOff className="h-3 w-3 text-red-400/60 animate-pulse" />}
        </div>

        <div className="flex-1" />

        <button onClick={handleUndo} title="Undo (⌘Z)"
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleRedo} title="Redo (⌘⇧Z)"
          className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 mx-1" style={{ background: 'rgba(255,255,255,0.06)' }} />

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

        <button onClick={() => doSave()} disabled={isSaving}
          className="h-7 px-3 rounded-md text-[11px] font-semibold flex items-center gap-1 text-black transition-all hover:scale-[1.02] disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {isSaving ? 'Saving' : isDirty ? 'Save*' : 'Saved'}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={() => setShowAI(!showAI)}
          className={`h-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-medium transition-colors ${showAI ? 'text-white/70' : 'text-white/30 hover:text-white/50'}`}
          style={showAI ? { background: 'rgba(34,197,94,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' } : { borderRight: '1px solid rgba(255,255,255,0.04)' }}>
          <Sparkles className="h-3 w-3" style={{ color: '#22c55e' }} /> AI
        </button>
        <div className="flex-1">
          <EditorToolbar editorRef={editorRef} content={content} setContent={setContent} setIsDirty={setIsDirty}
            projectType={projectType} onOpenAI={() => setShowAI(true)} onImageUpload={handleImageUpload} />
        </div>
      </div>

      {/* AI Panel + Editor + Preview */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* AI Panel — left side */}
        <AIContentPanel open={showAI} onClose={() => setShowAI(false)} projectType={projectType}
          projectName={projectName} content={content} setContent={setContent} setIsDirty={setIsDirty} />

        {/* Editor pane */}
        {viewMode !== 'preview' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} h-full flex flex-col relative`}
            style={viewMode === 'split' ? { borderRight: '1px solid rgba(255,255,255,0.06)' } : {}}>
            <textarea ref={editorRef}
              className="flex-1 w-full border-none resize-none font-mono focus:ring-0 focus:outline-none bg-transparent text-white/80 placeholder-white/15"
              value={content} onChange={e => {
                setContent(e.target.value);
                updateCursor(e.target.selectionStart, e.target.selectionEnd - e.target.selectionStart);
              }}
              onSelect={handleEditorSelect}
              onClick={handleEditorSelect}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={e => {
                e.preventDefault();
                const droppedText = e.dataTransfer.getData('text/plain');
                if (!droppedText) return;
                const ta = editorRef.current;
                if (!ta) return;
                // Insert at drop position
                const pos = ta.selectionStart;
                const sep = content.trim() && pos > 0 ? (projectType === 'latex' ? '\n\n' : '\n\n---\n\n') : '';
                const newContent = content.slice(0, pos) + sep + droppedText + content.slice(pos);
                setContent(newContent);
                setIsDirty(true);
                toast.success('Content dropped into editor');
              }}
              placeholder={projectType === 'latex' ? '% Start typing LaTeX here...' : 'Start typing your document here...'}
              style={{ fontSize: '13px', lineHeight: '1.7', padding: '1rem 1.25rem', tabSize: 2 }} />

            {/* Inline peer cursors with name labels */}
            <PeerCursors textareaRef={editorRef as any} content={content} peers={peers} />
          </div>
        )}

        {/* Preview pane */}
        {viewMode !== 'code' && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} h-full overflow-auto`} style={{ padding: '1rem 1.25rem' }}>
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

      {/* Co-Authors Dialog */}
      <Dialog open={showCoAuthorsDialog} onOpenChange={setShowCoAuthorsDialog}>
        <DialogContent className="sm:max-w-md" style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}>
          <DialogHeader>
            <DialogTitle className="text-white/90 text-lg flex items-center gap-2"><Users className="h-5 w-5"/> Co-Authors</DialogTitle>
            <DialogDescription className="text-white/40">Add users who can view and edit this document in real-time.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-white/30" />
              <Input placeholder="Search username..." value={searchUserQuery} onChange={e => setSearchUserQuery(e.target.value)}
                className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20" />
            </div>
            
            {userSearchResults.length > 0 && (
              <div className="flex flex-col gap-1 border border-white/10 rounded-lg p-1 bg-white/5 max-h-40 overflow-y-auto">
                {userSearchResults.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-md group">
                    <span className="text-sm text-white/80">{u.username}</span>
                    <button onClick={() => addCoAuthor(u.id, u.username)} disabled={coAuthors.includes(u.id)}
                      className="text-white/30 hover:text-green-400 disabled:opacity-30 disabled:hover:text-white/30 transition-colors">
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2">
              <h4 className="text-xs font-semibold text-white/40 uppercase mb-2">Current Co-Authors</h4>
              {coAuthors.length === 0 ? <p className="text-xs text-white/20">No co-authors added yet.</p> : (
                <div className="flex flex-col gap-2">
                  {coAuthors.map((id, idx) => (
                    <div key={id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: pickColorForList(coAuthorUsernames[idx] || id) }}>
                          {(coAuthorUsernames[idx] || id)[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm text-white/70">{coAuthorUsernames[idx] || id}</span>
                      </div>
                      <button onClick={() => removeCoAuthor(id)} className="text-white/20 hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

// Utility to pick a consistent color for co-author list display
const COLORS = ['#f472b6', '#fb923c', '#a78bfa', '#34d399', '#60a5fa', '#fbbf24', '#e879f9', '#22d3ee'];
function pickColorForList(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}
