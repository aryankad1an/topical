import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/utils';
import type { DocFormat } from '@/lib/types';
import type { OutlineNode } from '../lib/outline';
import { ancestorTitles, childTitles, outlineDigest, pathNumber, type OutlineTree } from '../lib/tree';
import { generateSection, type GenerationMethod } from '../lib/generation';
import type { RowStatus } from '../components/OutlineRow';

/** Which sections a batch covers. */
export type WriteScope = 'all' | 'missing';

interface Options {
  format: DocFormat;
  projectName: string;
  tree: OutlineTree;
  /** Words already written under a heading, by source offset. */
  wordsOf: (node: OutlineNode) => number;
  onInsertSection: (text: string, title: string, replace: boolean) => void;
  /** Keep the document showing whichever section is being written. */
  onFocusSection?: (node: OutlineNode) => void;
}

/**
 * Turning outline rows into prose, one section at a time.
 *
 * Holds what a run needs to be legible while it happens — which rows are
 * working, which failed, which one is being written right now, how far a batch
 * has got — and the choice of source material every request is made against.
 *
 * Every request is built from the tree index rather than from the flat list,
 * so a section is told where it sits (its number, the headings above it) and
 * which of its neighbours are already on the page. That is the difference
 * between "avoid overlapping with the other sections" as an instruction and
 * as something the model can actually act on.
 */
export function useSectionWriter({
  format, projectName, tree, wordsOf, onInsertSection, onFocusSection,
}: Options) {
  /**
   * Which rows are working or have failed, keyed by source offset.
   *
   * Not by title: two sections may legitimately share a name, and keying on it
   * put the spinner on every row called "Overview" the moment one of them
   * started, then cleared them all together.
   */
  const [status, setStatus] = useState<Record<number, RowStatus>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [method, setMethod] = useState<GenerationMethod>('web');
  const [urls, setUrls] = useState(['']);

  const stopRequested = useRef(false);

  const readyUrls = urls.filter(u => u.trim());
  const needsUrls = method === 'urls' && readyUrls.length === 0;

  /** Sections with no prose behind them yet — what "write the rest" means. */
  const missing = tree.nodes.filter(node => node.label.trim() && wordsOf(node) === 0);

  const writeSection = async (node: OutlineNode, instruction = ''): Promise<boolean> => {
    const index = tree.byOffset.get(node.offset);
    if (index === undefined) return false;

    setBusy(true);
    setStatus(prev => ({ ...prev, [node.offset]: 'generating' }));
    onFocusSection?.(node);
    try {
      const text = await generateSection({
        format,
        method,
        mainTopic: projectName,
        section: { title: node.label, level: node.level },
        children: childTitles(tree, index),
        ancestors: ancestorTitles(tree, index),
        sectionNumber: pathNumber(tree.entries[index]),
        // Rebuilt per section so the marks stay true as the run proceeds: by
        // the time section 4 is written, sections 1-3 exist, and the model
        // should be told so rather than sent the outline as it looked before
        // the batch started.
        digest: outlineDigest(tree, { words: wordsOf, focus: index }),
        urls: readyUrls,
        instruction,
      });
      // The heading is always already on the page, so this always replaces
      // what sits under it rather than adding a second copy.
      onInsertSection(text, node.label, true);
      setStatus(prev => { const next = { ...prev }; delete next[node.offset]; return next; });
      return true;
    } catch (error) {
      // Mark it failed rather than clearing it: a row that looks untouched
      // gives no hint anything went wrong, and the spinner would hang forever.
      setStatus(prev => ({ ...prev, [node.offset]: 'failed' }));
      toast.error(errorMessage(error, `Could not write "${node.label}"`));
      return false;
    } finally {
      setBusy(false);
    }
  };

  /**
   * Write a run of sections, in document order. Stops on the first failure —
   * continuing would fire one doomed request per section and bury the writer
   * under identical error toasts, since the usual cause (a bad key, an
   * unreachable provider) fails all of them.
   *
   * The scope is explicit. It used to always be every section, which quietly
   * rewrote finished work whenever someone added one heading to a drafted
   * document and pressed the only button in the foot.
   */
  const writeAll = async (scope: WriteScope = 'missing', instruction = '') => {
    const pending = (scope === 'all' ? tree.nodes : missing).filter(node => node.label.trim());
    if (!pending.length) {
      toast.info(scope === 'all'
        ? 'Add some sections to the outline first'
        : 'Every section already has content.');
      return;
    }
    stopRequested.current = false;
    setProgress({ done: 0, total: pending.length, title: pending[0].label });

    let completed = 0;
    for (const node of pending) {
      if (stopRequested.current) break;
      setProgress({ done: completed, total: pending.length, title: node.label });
      // The same instruction goes to every section in the run — it is a
      // standing note about the batch ("keep each one short"), not a
      // per-section brief.
      if (!(await writeSection(node, instruction))) break;
      completed += 1;
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
    missing: missing.length,
    writeSection, writeAll,
    stop: () => { stopRequested.current = true; },
  };
}
