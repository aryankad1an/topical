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
/**
 * A topic tree as the AI service returns it.
 *
 * `subtopics` holds either a bare name or another node, so a hierarchy can be
 * as deep as the subject actually is. It used to be `string[]`, which capped
 * every generated outline at two levels no matter how the model was asked —
 * the rail draws six, and the third level had nowhere to land.
 */
export interface TopicHierarchy {
  topic: string;
  subtopics?: (string | TopicHierarchy)[];
}

/** LaTeX documents are stored with a `latex:` prefix on their main topic. */
export const LATEX_PREFIX = 'latex:';

export function formatOf(mainTopic: string | undefined | null): DocFormat {
  return mainTopic?.startsWith(LATEX_PREFIX) ? 'latex' : 'mdx';
}
