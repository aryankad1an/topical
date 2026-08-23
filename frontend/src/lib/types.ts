/**
 * Shapes shared between the API client, the editor, and the reader.
 *
 * These used to live inside a zustand store that also carried ~30 fields of
 * UI state for a screen that no longer exists; the types were the only part
 * anything still imported.
 */

/** Which language a document is written in. Drives toolbar, highlighting and preview. */
export type DocFormat = 'mdx' | 'latex';

export interface SavedLessonTopic {
  topic: string;
  mdxContent: string;
  isSubtopic: boolean;
  parentTopic?: string;
  mainTopic?: string;
}

export interface LessonPlan {
  id?: number;
  name: string;
  mainTopic: string;
  topics: SavedLessonTopic[];
  coAuthors?: string[];
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** One branch of a generated outline. */
export interface TopicHierarchy {
  topic: string;
  subtopics: string[];
}

/** LaTeX documents are stored with a `latex:` prefix on their main topic. */
export const LATEX_PREFIX = 'latex:';

export function formatOf(mainTopic: string | undefined | null): DocFormat {
  return mainTopic?.startsWith(LATEX_PREFIX) ? 'latex' : 'mdx';
}
