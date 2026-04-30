import { useState, useRef } from 'react';
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

  if (!open) return null;

  return (
    <div className="h-full flex flex-col shrink-0" style={{
      width: '320px',
      background: 'rgba(8,8,8,0.98)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />
          <span className="text-xs font-semibold text-white/70">AI Content</span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: projectType === 'latex' ? 'rgba(59,130,246,0.12)' : 'rgba(34,197,94,0.12)', color: projectType === 'latex' ? '#60a5fa' : '#22c55e' }}>
            {projectType === 'latex' ? 'LaTeX' : 'MDX'}
          </span>
        </div>
        <button onClick={onClose} className="h-6 w-6 rounded flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {/* Search */}
        <div className="p-3 space-y-2">
          <div className="flex gap-1.5">
            <Input placeholder="e.g. Machine Learning, React Hooks..." value={topic}
              onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchHierarchy(); }}
              className="flex-1 h-8 text-xs bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus-visible:ring-1 focus-visible:ring-white/15" />
            <button onClick={searchHierarchy} disabled={isLoadingHierarchy || !topic.trim()}
              className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 disabled:opacity-30 transition-colors"
              style={{ background: 'rgba(34,197,94,0.15)' }}>
              {isLoadingHierarchy ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#22c55e' }} /> : <Search className="h-3.5 w-3.5" style={{ color: '#22c55e' }} />}
            </button>
          </div>

          {/* Method toggle */}
          <div className="flex gap-0.5 p-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.02)' }}>
            {([
              { key: 'crawl' as const, icon: Globe, label: 'Web' },
              { key: 'llm' as const, icon: Cpu, label: 'LLM' },
              { key: 'urls' as const, icon: Link2, label: 'URLs' },
            ]).map(m => (
              <button key={m.key} onClick={() => setMethod(m.key)}
                className={`flex-1 py-1.5 rounded text-[10px] font-medium flex items-center justify-center gap-1 transition-colors ${method === m.key ? 'text-white/70' : 'text-white/25'}`}
                style={method === m.key ? { background: 'rgba(34,197,94,0.08)' } : {}}>
                <m.icon className="h-3 w-3" />{m.label}
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

        {/* Loading hierarchy */}
        {isLoadingHierarchy && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: '#22c55e' }} />
            <span className="ml-2 text-white/30 text-xs">Generating hierarchy...</span>
          </div>
        )}

        {/* Hierarchy */}
        {hierarchy.length > 0 && (
          <div className="px-3 pb-2">
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

        {/* Generated Snippets — draggable */}
        {snippets.length > 0 && (
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between mb-1.5 mt-1">
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Generated ({snippets.length})</span>
              <button onClick={() => {
                const sep = projectType === 'latex' ? '\n\n' : '\n\n---\n\n';
                const all = snippets.map(s => s.content).join(sep);
                const prefix = content.trim() ? sep : '';
                setContent(content + prefix + all);
                setIsDirty(true);
                toast.success('Inserted all snippets');
              }}
                className="text-[10px] px-2 py-0.5 rounded text-white/30 hover:text-white/60 transition-colors" style={{ background: 'rgba(255,255,255,0.03)' }}>
                Insert All
              </button>
            </div>
            <div className="space-y-1.5">
              {snippets.map(snippet => (
                <div
                  key={snippet.id}
                  draggable
                  onDragStart={e => handleDragStart(e, snippet)}
                  className="rounded-lg border transition-all cursor-grab active:cursor-grabbing group"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-1.5 px-2.5 py-2">
                    <GripVertical className="h-3 w-3 text-white/15 shrink-0 group-hover:text-white/30" />
                    <button className="flex-1 text-left" onClick={() => setExpandedSnippet(expandedSnippet === snippet.id ? null : snippet.id)}>
                      <span className="text-[11px] font-medium text-white/60 truncate block">{snippet.topic}</span>
                      <span className="text-[9px] text-white/20">{snippet.content.length} chars</span>
                    </button>
                    <button onClick={() => insertSnippet(snippet)} title="Insert into editor"
                      className="h-5 px-1.5 rounded text-[9px] font-medium text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors opacity-0 group-hover:opacity-100">
                      Insert
                    </button>
                    <button onClick={() => removeSnippet(snippet.id)} title="Remove"
                      className="h-5 w-5 rounded flex items-center justify-center text-white/15 hover:text-red-400/70 transition-colors opacity-0 group-hover:opacity-100">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  {expandedSnippet === snippet.id && (
                    <div className="px-2.5 pb-2.5">
                      <pre className="text-[10px] text-white/30 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap font-mono rounded p-2"
                        style={{ background: 'rgba(0,0,0,0.3)' }}>
                        {snippet.content.slice(0, 500)}{snippet.content.length > 500 ? '...' : ''}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoadingHierarchy && hierarchy.length === 0 && snippets.length === 0 && (
          <div className="text-center py-10 px-4 text-white/15">
            <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p className="text-[10px]">Search a topic to generate a hierarchy, then click topics to create content snippets</p>
            <p className="text-[9px] mt-1 text-white/10">Drag snippets to the editor or click Insert</p>
          </div>
        )}
      </div>
    </div>
  );
}
