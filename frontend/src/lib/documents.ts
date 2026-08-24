/**
 * Turning a stored lesson plan back into the document the editor shows.
 *
 * A document is persisted as an array of `topics`, each holding a slice of
 * markup — a shape left over from when the app generated one topic at a time.
 * Reassembling it is a three-step dance (drop the empty ones, strip any
 * frontmatter the model added, join with a separator) and it was written out
 * by hand in the editor, the workspace and the reader.
 *
 * The three copies had already drifted: the reader joined with `\n\n` while
 * the other two used `\n\n---\n\n`, so opening the same document read-only
 * silently fused sections that the editor kept apart.
 */

import { stripFrontmatter } from '@/lib/utils';

/** The separator between stored topics. Also what the editor writes between blocks. */
export const TOPIC_SEPARATOR = '\n\n---\n\n';

/** Reassemble a stored document's markup, in order. */
export function documentContent(topics: { mdxContent?: string | null }[] | undefined): string {
  return (topics ?? [])
    .filter(topic => topic.mdxContent?.trim())
    .map(topic => stripFrontmatter(topic.mdxContent as string))
    .join(TOPIC_SEPARATOR);
}
