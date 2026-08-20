/**
 * Content generation calls, with the envelope parsing in one place.
 *
 * The AI service returns hierarchies as a ```json fence inside a JSON
 * envelope; unwrapping that at three call sites is how the old panel ended up
 * with three different failure messages for the same problem.
 */

import {
  generateLatexCrawlRaw, generateLatexFromUrlsRaw, generateLatexLlmOnlyRaw,
  generateMdxFromUrlsRaw, generateMdxLlmOnlyRaw, generateSingleTopicRaw,
  outlineFromDocument, searchTopics,
} from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import type { DocFormat, TopicHierarchy } from '@/lib/types';

export type GenerationMethod = 'crawl' | 'llm' | 'urls';

export interface SectionRequest {
  format: DocFormat;
  method: GenerationMethod;
  topic: string;
  mainTopic: string;
  hierarchy: TopicHierarchy[];
  urls: string[];
}

/** Generate one section, cleaned of any frontmatter the model added. */
export async function generateSection(req: SectionRequest): Promise<string> {
  const { format, method, topic, mainTopic, urls } = req;
  const hierarchy = JSON.stringify(req.hierarchy);

  if (method === 'urls' && urls.length === 0) {
    throw new Error('Add at least one URL to generate from.');
  }

  const raw = format === 'latex'
    ? method === 'crawl' ? await generateLatexCrawlRaw(topic, mainTopic, hierarchy)
      : method === 'llm' ? await generateLatexLlmOnlyRaw(topic, mainTopic, hierarchy)
        : await generateLatexFromUrlsRaw(urls, topic, mainTopic, hierarchy)
    : method === 'crawl' ? await generateSingleTopicRaw(topic, mainTopic, 3, hierarchy)
      : method === 'llm' ? await generateMdxLlmOnlyRaw(topic, mainTopic, hierarchy)
        : await generateMdxFromUrlsRaw(urls, topic, mainTopic, topic, true, hierarchy);

  return stripFrontmatter(raw);
}

/** Ask for an outline of a subject the writer names. */
export async function fetchHierarchy(query: string): Promise<TopicHierarchy[]> {
  return parseHierarchy(await searchTopics(query));
}

/** Ask for the outline the current draft is reaching for. */
export async function outlineDraft(content: string, format: DocFormat): Promise<TopicHierarchy[]> {
  return parseHierarchy(await outlineFromDocument(content, format));
}

function parseHierarchy(envelope: unknown): TopicHierarchy[] {
  const raw = envelope && typeof envelope === 'object' && 'data' in envelope
    ? (envelope as { data?: { topics?: string } }).data?.topics
    : undefined;
  if (!raw) throw new Error('The model did not return any topics. Try rewording the subject.');

  const json = raw.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ?? raw;
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('The model did not return any topics. Try rewording the subject.');
  }
  return parsed as TopicHierarchy[];
}
