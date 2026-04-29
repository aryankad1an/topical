import { useState } from 'react';
import { toast } from 'sonner';
import {
  searchTopics,
  generateSingleTopicRaw, generateMdxLlmOnlyRaw, generateMdxFromUrlsRaw,
  generateLatexLlmOnlyRaw, generateLatexCrawlRaw, generateLatexFromUrlsRaw,
} from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { Sparkles, Loader2, X, Globe, Cpu, Link2, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AIContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectType: 'mdx' | 'latex';
  projectName: string;
  content: string;
  setContent: (c: string) => void;
  setIsDirty: (d: boolean) => void;
}

export function AIContentDialog({ open, onOpenChange, projectType, projectName, content, setContent, setIsDirty }: AIContentDialogProps) {
  const [topic, setTopic] = useState('');
  const [method, setMethod] = useState<'crawl' | 'llm' | 'urls'>('crawl');
  const [urls, setUrls] = useState(['']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hierarchy, setHierarchy] = useState<{ topic: string; subtopics: string[] }[]>([]);
  const [isLoadingHierarchy, setIsLoadingHierarchy] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

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
      const sep = content.trim() ? (projectType === 'latex' ? '\n\n' : '\n\n---\n\n') : '';
      setContent(content + sep + cleaned);
      setIsDirty(true);
      toast.success(`Generated "${t}"`);
    } catch { toast.error('Generation failed'); }
    finally { setIsGenerating(false); }
  };

  const generateAll = async () => {
    for (const item of hierarchy) {
      await generateForTopic(item.topic);
      for (const sub of item.subtopics) await generateForTopic(sub);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" style={{
        background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(40px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px',
      }}>
        <DialogHeader>
          <DialogTitle className="text-white/90 flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: '#22c55e' }} />
            Generate AI Content
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded ml-1"
              style={{ background: projectType === 'latex' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)', color: projectType === 'latex' ? '#60a5fa' : '#22c55e' }}>
              {projectType === 'latex' ? 'LaTeX' : 'MDX'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-white/40">
            Search a topic → generate hierarchy → click topics to populate content.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mt-2">
          <Input placeholder="e.g. Machine Learning, React Hooks..." value={topic}
            onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchHierarchy(); }}
            className="glass-input flex-1" />
          <Button onClick={searchHierarchy} disabled={isLoadingHierarchy || !topic.trim()}
            className="text-black font-semibold shrink-0" style={{ background: 'linear-gradient(135deg, #22c55e, #4ade80)' }}>
            {isLoadingHierarchy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex gap-1 p-1 rounded-lg mt-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {([
            { key: 'crawl' as const, icon: Globe, label: 'Web Crawl' },
            { key: 'llm' as const, icon: Cpu, label: 'LLM Only' },
            { key: 'urls' as const, icon: Link2, label: 'From URLs' },
          ]).map(m => (
            <button key={m.key} onClick={() => setMethod(m.key)}
              className={`flex-1 py-2 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${method === m.key ? 'text-white/80' : 'text-white/30'}`}
              style={method === m.key ? { background: 'rgba(34,197,94,0.1)' } : {}}>
              <m.icon className="h-3 w-3" />{m.label}
            </button>
          ))}
        </div>

        {method === 'urls' && (
          <div className="space-y-2 mt-2">
            {urls.map((u, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="https://..." value={u} className="glass-input flex-1 text-xs"
                  onChange={e => { const a = [...urls]; a[i] = e.target.value; setUrls(a); }} />
                {urls.length > 1 && <button onClick={() => setUrls(urls.filter((_, j) => j !== i))}
                  className="h-9 w-9 rounded-md flex items-center justify-center text-red-400/60 hover:text-red-400"><X className="h-3 w-3" /></button>}
              </div>
            ))}
            {urls.length < 4 && <button onClick={() => setUrls([...urls, ''])}
              className="text-xs text-white/30 hover:text-white/50 flex items-center gap-1"><Plus className="h-3 w-3" /> Add URL</button>}
          </div>
        )}

        {isLoadingHierarchy && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#22c55e' }} />
            <span className="ml-2 text-white/40 text-sm">Generating hierarchy...</span>
          </div>
        )}

        {hierarchy.length > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/50">Click a topic to generate</span>
              <button onClick={generateAll} disabled={isGenerating}
                className="text-xs px-2 py-1 rounded-md" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>Generate All</button>
            </div>
            {hierarchy.map((item, i) => (
              <div key={i}>
                <button onClick={() => generateForTopic(item.topic)} disabled={isGenerating}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeTopic === item.topic && isGenerating ? 'text-white/60' : 'text-white/70 hover:text-white/90 hover:bg-white/[0.03]'}`}
                  style={activeTopic === item.topic && isGenerating ? { background: 'rgba(34,197,94,0.05)' } : {}}>
                  <div className="flex items-center gap-2">
                    {activeTopic === item.topic && isGenerating
                      ? <Loader2 className="h-3 w-3 animate-spin shrink-0" style={{ color: '#22c55e' }} />
                      : <Sparkles className="h-3 w-3 shrink-0" style={{ color: '#22c55e' }} />}
                    {item.topic}
                  </div>
                </button>
                {item.subtopics.map((sub, j) => (
                  <button key={j} onClick={() => generateForTopic(sub)} disabled={isGenerating}
                    className={`w-full text-left pl-8 pr-3 py-1.5 rounded-lg text-xs transition-all ${activeTopic === sub && isGenerating ? 'text-white/50' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.02]'}`}>
                    <div className="flex items-center gap-2">
                      {activeTopic === sub && isGenerating
                        ? <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" style={{ color: '#22c55e' }} />
                        : <div className="h-1 w-1 rounded-full bg-white/20 shrink-0" />}
                      {sub}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {!isLoadingHierarchy && hierarchy.length === 0 && (
          <div className="text-center py-8 text-white/20">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Search a topic to generate a content hierarchy</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
