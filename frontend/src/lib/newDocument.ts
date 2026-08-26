/**
 * Starting a document.
 *
 * A document is created before it is opened, everywhere. That is what lets
 * every document have a URL from the first moment it exists — there is no
 * "unsaved document" that the editor has to hold in memory and mint an address
 * for on its first save, and so no window in which the thing on screen cannot
 * be linked to or shared.
 *
 * The projects page already worked this way. The command palette did not: its
 * "New MDX document" opened a blank, id-less editor, which is the one path
 * that could still produce a document without an address.
 */

import { saveLessonPlan, type LessonPlanResponse } from '@/lib/api';
import { LATEX_PREFIX, type DocFormat } from '@/lib/types';

/** The name a document gets when it is started without a subject. */
export const UNTITLED = 'Untitled document';

/**
 * Create an empty document and return it.
 *
 * The topic is the document's name and its subject at once — which is what it
 * always was; `mainTopic` carries the format as a prefix rather than there
 * being a column for it.
 */
export async function createDocument(
  topic: string,
  format: DocFormat,
): Promise<LessonPlanResponse> {
  const name = topic.trim() || UNTITLED;
  return saveLessonPlan({
    name,
    mainTopic: format === 'latex' ? `${LATEX_PREFIX}${name}` : name,
    topics: [],
  });
}
