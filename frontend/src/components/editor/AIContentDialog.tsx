import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  searchTopics,
  generateSingleTopicRaw, generateMdxLlmOnlyRaw, generateMdxFromUrlsRaw,
  generateLatexLlmOnlyRaw, generateLatexCrawlRaw, generateLatexFromUrlsRaw,
} from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { Sparkles, Loader2, X, Globe, Cpu, Link2, Search, Plus, GripVertical, ChevronRight, PanelLeftClose } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AIContentPanelProps {
  open: boolean;
  onClose: () => void;
  projectType: 'mdx' | 'latex';
  projectName: string;
  content: string;
  setContent: (c: string) => void;
  setIsDirty: (d: boolean) => void;
}

interface GeneratedSnippet {
  id: string;
  topic: string;
  content: string;
  timestamp: number;
}

export function AIContentPanel({ open, onClose, projectType, projectName, content, setContent, setIsDirty }: AIContentPanelProps) {
  const [topic, setTopic] = useState('');
  const [method, setMethod] = useState<'crawl' | 'llm' | 'urls'>('crawl');
  const [urls, setUrls] = useState(['']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hierarchy, setHierarchy] = useState<{ topic: string; subtopics: string[] }[]>([]);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<GeneratedSnippet[]>([]);
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);

  // Sidebar state
  const width = 380;

  const searchHierarchy = async () => {
    if (!topic.trim()) return;
    setIsLoadingHierarchy(true);
    setHierarchy([]);
    try {
      const res = await searchTopics(topic);
      if (res && 'data' in res && res.data?.topics) {
        const m = (res.data.topics as string).match(/```json\n([\s\S]*?)\n```/);
        if (m?.[1]) setHierarchy(JSON.parse(m[1]));
      }
    } catch { toast.error('Failed to generate hierarchy'); }
    finally { setIsLoadingHierarchy(false); }
  };

  const generateForTopic = async (t: string) => {
    setIsGenerating(true);
    setActiveTopic(t);
    try {
      const main = topic || projectName;
      const h = JSON.stringify(hierarchy);
      let raw: string;

      if (projectType === 'latex') {
        if (method === 'crawl') raw = await generateLatexCrawlRaw(t, main, h);
        else if (method === 'llm') raw = await generateLatexLlmOnlyRaw(t, main, h);
        else {
          const valid = urls.filter(u => u.trim());
          if (!valid.length) { toast.error('Enter at least one URL'); setIsGenerating(false); return; }
          raw = await generateLatexFromUrlsRaw(valid, t, main, h);
        }
      } else {
        if (method === 'crawl') raw = await generateSingleTopicRaw(t, main, 3, h);
        else if (method === 'llm') raw = await generateMdxLlmOnlyRaw(t, main, h);
        else {
          const valid = urls.filter(u => u.trim());
          if (!valid.length) { toast.error('Enter at least one URL'); setIsGenerating(false); return; }
          raw = await generateMdxFromUrlsRaw(valid, t, main, t, true, h);
        }
      }

      const cleaned = stripFrontmatter(raw);
      // Add to snippets list instead of directly inserting
      const snippet: GeneratedSnippet = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topic: t,
        content: cleaned,
        timestamp: Date.now(),
      };
      setSnippets(prev => [snippet, ...prev]);
      setExpandedSnippet(snippet.id);
      toast.success(`Generated "${t}" — drag it to the editor or click to insert`);
    } catch { toast.error('Generation failed'); }
    finally { setIsGenerating(false); }
  };

  const generateAll = async () => {
    for (const item of hierarchy) {
      await generateForTopic(item.topic);
      for (const sub of item.subtopics) await generateForTopic(sub);
    }
  };

  const insertSnippet = (snippet: GeneratedSnippet) => {
    const sep = content.trim() ? (projectType === 'latex' ? '\n\n' : '\n\n---\n\n') : '';
    setContent(content + sep + snippet.content);
    setIsDirty(true);
    toast.success(`Inserted "${snippet.topic}"`);
  };

  const removeSnippet = (id: string) => {
    setSnippets(prev => prev.filter(s => s.id !== id));
  };

  const handleDragStart = (e: React.DragEvent, snippet: GeneratedSnippet) => {
    dragRef.current = snippet.id;
    e.dataTransfer.setData('text/plain', snippet.content);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Window drag/resize handlers
  useEffect(() => {
    // Left intentionally blank as drag logic was removed
  }, []);

  return (
    <div className="flex flex-col shrink-0 h-full transition-all duration-300 ease-in-out overflow-hidden" 
      style={{ 
        width: open ? `${width}px` : '0px', 
        opacity: open ? 1 : 0, 
        borderRight: open ? '1px solid rgba(255,255,255,0.04)' : 'none',
        background: 'transparent',
      }}>
      <div className="flex flex-col h-full shrink-0" style={{ width: `${width}px` }}>
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 py-4 shrink-0" 
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4" style={{ color: '#22c55e' }} />
            <span className="text-sm font-semibold text-white/90">AI Generation</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: projectType === 'latex' ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)', color: projectType === 'latex' ? '#60a5fa' : '#22c55e' }}>
              {projectType === 'latex' ? 'LaTeX' : 'MDX'}
            </span>
          </div>
        </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {/* Search */}
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="e.g. Machine Learning, React Hooks..." value={topic}
              onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchHierarchy(); }}
              className="flex-1 h-10 text-sm bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20" />
            <button onClick={searchHierarchy} disabled={isLoadingHierarchy || !topic.trim()}
              className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 disabled:opacity-30 transition-colors cursor-pointer"
              style={{ background: 'rgba(34,197,94,0.15)' }}>
              {isLoadingHierarchy ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#22c55e' }} /> : <Search className="h-4 w-4" style={{ color: '#22c55e' }} />}
            </button>
          </div>

          {/* Method toggle */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
            {([
              { key: 'crawl' as const, icon: Globe, label: 'Web Search' },
              { key: 'llm' as const, icon: Cpu, label: 'LLM Only' },
              { key: 'urls' as const, icon: Link2, label: 'URLs' },
            ]).map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`flex-1 py-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${method === m.key ? 'text-white/90 shadow-sm' : 'text-white/40 hover:text-white/60'}`}
                style={method === m.key ? { background: 'rgba(34,197,94,0.15)' } : {}}>
                <m.icon className="h-3.5 w-3.5" />{m.label}
              </button>
            ))}
          </div>

          {/* URL inputs */}
          {method === 'urls' && (
            <div className="space-y-1.5">
              {urls.map((u, i) => (
                <div key={i} className="flex gap-1">
                  <Input placeholder="https://..." value={u} className="flex-1 h-7 text-[10px] bg-white/[0.02] border-white/[0.05] text-white"
                    onChange={e => { const a = [...urls]; a[i] = e.target.value; setUrls(a); }} />
                  {urls.length > 1 && <button onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                    className="h-7 w-7 rounded flex items-center justify-center text-red-400/50 hover:text-red-400"><X className="h-2.5 w-2.5" /></button>}
                </div>
              ))}
              {urls.length < 4 && <button onClick={() => setUrls([...urls, ''])}
                className="text-[10px] text-white/20 hover:text-white/40 flex items-center gap-1"><Plus className="h-2.5 w-2.5" /> Add URL</button>}
            </div>
          )}
        </div>

        {/* Generated Snippets — draggable */}
        {snippets.length > 0 && (
          <div className="px-4 pb-6 mt-4">
            <div className="flex items-center justify-between mb-3 mt-2 pt-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Generated Snippets ({snippets.length})</span>
              <button onClick={() => {
                const sep = projectType === 'latex' ? '\n\n' : '\n\n---\n\n';
                const all = snippets.map(s => s.content).join(sep);
                const prefix = content.trim() ? sep : '';
                setContent(content + prefix + all);
                setIsDirty(true);
                toast.success('Inserted all snippets');
              }}
                className="text-xs font-medium px-3 py-1.5 rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)' }}>
                Insert All
              </button>
            </div>
            <div className="space-y-3">
              {snippets.map(snippet => (
                <div
                  key={snippet.id}
                  draggable
                  onDragStart={e => handleDragStart(e, snippet)}
                  className="rounded-xl border transition-all cursor-grab active:cursor-grabbing group bg-white/[0.02] hover:bg-white/[0.04]"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <GripVertical className="h-4 w-4 text-white/20 shrink-0 group-hover:text-white/50 transition-colors" />
                    <button className="flex-1 text-left cursor-pointer" onClick={() => setExpandedSnippet(expandedSnippet === snippet.id ? null : snippet.id)}>
                      <span className="text-sm font-semibold text-white/80 block">{snippet.topic}</span>
                      <span className="text-xs text-white/30">{snippet.content.length} characters • Drag to Editor</span>
                    </button>
                    <button onClick={() => insertSnippet(snippet)} title="Insert into editor"
                      className="h-7 px-2.5 rounded-md text-xs font-semibold text-white/60 hover:text-white hover:bg-green-500/20 hover:text-green-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                      Insert
                    </button>
                    <button onClick={() => removeSnippet(snippet.id)} title="Remove"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {expandedSnippet === snippet.id && (
                    <div className="px-3 pb-3">
                      <pre className="text-xs text-white/50 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-mono rounded-lg p-3"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px inset rgba(255,255,255,0.05)' }}>
                        {snippet.content.slice(0, 500)}{snippet.content.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Divider between Snippets and Hierarchy */}
            {hierarchy.length > 0 && (
              <div className="mt-6 border-b border-white/5" />
            )}
          </div>
        )}

        {/* Loading hierarchy */}
        {isLoadingHierarchy && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#22c55e' }} />
            <span className="ml-2 text-white/30 text-xs">Generating hierarchy...</span>
          </div>
        )}

        {/* Hierarchy */}
        {hierarchy.length > 0 && (
          <div className="px-3 pb-2 pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Topics</span>
              <button onClick={generateAll} disabled={isGenerating}
                className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.08)', color: '#22c55e' }}>Generate All</button>
            </div>
            <div className="space-y-0.5">
              {hierarchy.map((item, i) => (
                <div key={i}>
                  <button onClick={() => generateForTopic(item.topic)} disabled={isGenerating}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${activeTopic === item.topic && isGenerating ? 'text-white/50' : 'text-white/60 hover:text-white/80 hover:bg-white/[0.03]'}`}>
                    <div className="flex items-center gap-1.5">
                      {activeTopic === item.topic && isGenerating
                        ? <Loader2 className="h-3 w-3 animate-spin shrink-0" style={{ color: '#22c55e' }} />
                        : <ChevronRight className="h-3 w-3 shrink-0 text-white/20" />}
                      <span className="truncate">{item.topic}</span>
                    </div>
                  </button>
                  {item.subtopics.map((sub, j) => (
                    <button key={j} onClick={() => generateForTopic(sub)} disabled={isGenerating}
                      className={`w-full text-left pl-7 pr-2.5 py-1 rounded-md text-[11px] transition-all ${activeTopic === sub && isGenerating ? 'text-white/40' : 'text-white/35 hover:text-white/60 hover:bg-white/[0.02]'}`}>
                      <div className="flex items-center gap-1.5">
                        {activeTopic === sub && isGenerating
                          ? <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" style={{ color: '#22c55e' }} />
                          : <div className="h-1 w-1 rounded-full bg-white/15 shrink-0" />}
                        <span className="truncate">{sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingHierarchy && hierarchy.length === 0 && snippets.length === 0 && (
          <div className="text-center py-16 px-6 text-white/20">
            <Search className="h-10 w-10 mx-auto mb-4 opacity-40 text-green-500" />
            <p className="text-sm font-medium text-white/40">Search a topic to generate a hierarchy, then click topics to create content snippets.</p>
            <p className="text-xs mt-3 text-white/30">Drag generated snippets directly into your editor or click Insert.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
