/**
 * Content generation calls, with the envelope parsing in one place.
 *
 * The AI service returns hierarchies as a ```json fence inside a JSON
 * envelope; unwrapping that at three call sites is how the old panel ended up
 * with three different failure messages for the same problem.
 */

import { outlineFromDocument, refineOutline, requestSection, searchTopics } from '@/lib/api';
import type { GenerationSource, HierarchyEnvelope, OutlineChange, OutlineRowIn } from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import type { DocFormat, TopicHierarchy } from '@/lib/types';
import { normalise, planFromHierarchy, planItem, type PlanItem } from './plan';

/** Where a section's material comes from. Named as the AI service names it. */
export type GenerationMethod = GenerationSource;

/** The minimum an outline row has to be, for anything that only reads it. */
export interface OutlineRow {
  title: string;
  level: number;
}

export interface SectionRequest {
  format: DocFormat;
  method: GenerationMethod;
  mainTopic: string;
  /** The row being written. */
  section: OutlineRow;
  /** Its direct children — a parent gets an introduction, not their content. */
  children: string[];
  /** The headings it is nested inside, outermost first. */
  ancestors: string[];
  /** Its number in the outline — "2.3". */
  sectionNumber: string;
  /**
   * The whole outline as a numbered tree, marked with which sections already
   * have prose behind them. See `outlineDigest` in `lib/tree.ts`.
   */
  digest: string;
  urls: string[];
  /** What the writer asked for beyond the title — a length, a stance, an angle. */
  instruction?: string;
}

/** Generate one section, cleaned of any frontmatter the model added. */
export async function generateSection(req: SectionRequest): Promise<string> {
  if (req.method === 'urls' && req.urls.length === 0) {
    throw new Error('Add at least one URL to generate from.');
  }

  const raw = await requestSection({
    topic: req.section.title,
    main_topic: req.mainTopic,
    format: req.format,
    source: req.method,
    urls: req.urls,
    instruction: req.instruction,
    // Sent as numbered indented text rather than JSON: the outline is
    // arbitrarily deep, and an indented list carries that depth more legibly
    // than a nested object would. The numbering and the written/empty marks
    // are what make "do not repeat the other sections" checkable — a bare
    // list of titles gave the model no way to tell which of them exist.
    hierarchy: req.digest,
    // A section with children gets an introduction instead of an article —
    // its children write themselves, and a parent that covers them puts the
    // same prose in the document twice.
    children: req.children,
    // Where it sits. Without this, a level-3 section is written as though it
    // opened the document: it re-defines the terms its parent just defined,
    // because nothing told it a parent existed.
    ancestors: req.ancestors,
    section_number: req.sectionNumber,
    level: req.section.level,
  });

  return stripFrontmatter(raw);
}

/** Ask for an outline of a subject the writer names. */
export async function fetchHierarchy(query: string): Promise<PlanItem[]> {
  return planFromHierarchy(parseHierarchy(await searchTopics(query)));
}

/** Ask for the outline the current draft is reaching for. */
export async function outlineDraft(content: string, format: DocFormat): Promise<PlanItem[]> {
  return planFromHierarchy(parseHierarchy(await outlineFromDocument(content, format)));
}

function parseHierarchy(envelope: HierarchyEnvelope): TopicHierarchy[] {
  const raw = envelope.data?.topics;
  if (!raw) throw new Error('The model did not return any topics. Try rewording the subject.');

  const json = raw.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('The model did not return any topics. Try rewording the subject.');
  }
  return parsed as TopicHierarchy[];
}

export interface RefinedPlan {
  summary: string;
  plan: PlanItem[];
  changes: OutlineChange[];
}

/**
 * Ask for a restructured outline, with the reasoning kept alongside it.
 *
 * The result is deliberately *not* applied here — it comes back as a proposal
 * the panel can show next to the current outline, so the writer accepts a
 * restructure rather than discovering one.
 */
export async function refinePlan(
  items: OutlineRowIn[],
  subject: string,
  instruction: string,
  format: DocFormat,
): Promise<RefinedPlan> {
  const payload = items
    .filter(item => item.title.trim())
    .map(item => ({ title: item.title, level: item.level, words: item.words ?? 0 }));
  const result = await refineOutline(payload, subject, instruction, format);
  return {
    summary: result.summary,
    plan: normalise(result.outline.map(row => planItem(row.title, row.level))),
    changes: result.changes,
  };
}
