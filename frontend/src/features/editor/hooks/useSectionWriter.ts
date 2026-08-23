import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import type { OutlineNode } from '../lib/outline';
import { generateSection, type GenerationMethod, type OutlineRow } from '../lib/generation';
import type { RowStatus } from '../components/OutlineRow';

interface Options {
  format: DocFormat;
  projectName: string;
  nodes: OutlineNode[];
  outline: OutlineRow[];
  /** Direct children of a row — a parent writes an introduction, not their content. */
  childrenOf: (node: OutlineNode) => string[];
  onInsertSection: (text: string, title: string, replace: boolean) => void;
}

/**
 * Turning outline rows into prose, one section at a time.
 *
 * Holds what a run needs to be legible while it happens — which rows are
 * working, which failed, how far a batch has got — and the choice of source
 * material every request is made against.
 */
export function useSectionWriter({
  format, projectName, nodes, outline, childrenOf, onInsertSection,
}: Options) {
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [method, setMethod] = useState<GenerationMethod>('web');
  const [urls, setUrls] = useState(['']);

  const stopRequested = useRef(false);

  const readyUrls = urls.filter(u => u.trim());
  const needsUrls = method === 'urls' && readyUrls.length === 0;

  const writeSection = async (node: OutlineNode): Promise<boolean> => {
    setBusy(true);
    setStatus(prev => ({ ...prev, [node.label]: 'generating' }));
    try {
      const text = await generateSection({
        format,
        method,
        mainTopic: projectName,
        section: { title: node.label, level: node.level },
        children: childrenOf(node),
        outline,
        urls: readyUrls,
      });
      // The heading is always already on the page, so this always replaces
      // what sits under it rather than adding a second copy.
      onInsertSection(text, node.label, true);
      setStatus(prev => { const next = { ...prev }; delete next[node.label]; return next; });
      return true;
    } catch (error) {
      // Mark it failed rather than clearing it: a row that looks untouched
      // gives no hint anything went wrong, and the spinner would hang forever.
      setStatus(prev => ({ ...prev, [node.label]: 'failed' }));
      toast.error(errorMessage(error, `Could not write "${node.label}"`));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Write content for every section in the outline, in order. Stops on the
   * first failure — continuing would fire one doomed request per section and
   * bury the writer under identical error toasts, since the usual cause (a bad
   * key, an unreachable provider) fails all of them.
   */
  const writeAll = async () => {
    const pending = [...nodes];
    if (!pending.length) {
      toast.info('Add some sections to the outline first');
      return;
    }
    stopRequested.current = false;
    setProgress({ done: 0, total: pending.length });

    let completed = 0;
    for (const node of pending) {
      if (stopRequested.current) break;
      if (!(await writeSection(node))) break;
      completed += 1;
      setProgress({ done: completed, total: pending.length });
    }

    setProgress(null);
    if (completed < pending.length) {
      const why = stopRequested.current ? 'Stopped' : 'Stopped after an error';
      toast.info(`${why} — wrote ${completed} of ${pending.length}`);
    } else if (completed) {
      toast.success(`Wrote ${completed} ${completed === 1 ? 'section' : 'sections'}`);
    }
    stopRequested.current = false;
  };

  return {
    status, busy, progress, method, setMethod, urls, setUrls, needsUrls,
    writeSection, writeAll,
    stop: () => { stopRequested.current = true; },
  };
}
