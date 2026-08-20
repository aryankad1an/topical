/**
 * Inline AI actions offered on a selection.
 *
 * Ids match the `TRANSFORM_ACTIONS` table in `ai_service/prompts.py`; the
 * wording of the instruction lives there, and only what the writer sees lives
 * here.
 */

import {
  Wand2, Expand, Shrink, SpellCheck, Baby, GraduationCap,
  List, Table, Sigma, ArrowRight, HelpCircle, MessageSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface AiAction {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  /** Whether the result replaces the selection, or is just shown as an answer. */
  replaces: boolean;
  /** Offered even with nothing selected (operates on the passage around the caret). */
  worksOnCaret?: boolean;
}

export const AI_ACTIONS: AiAction[] = [
  { id: 'improve', label: 'Improve writing', hint: 'Clearer and more precise, same voice', icon: Wand2, replaces: true },
  { id: 'expand', label: 'Expand', hint: 'Add detail, examples, reasoning', icon: Expand, replaces: true },
  { id: 'shorten', label: 'Make it shorter', hint: 'About half the length, same points', icon: Shrink, replaces: true },
  { id: 'grammar', label: 'Fix grammar', hint: 'Spelling and punctuation only', icon: SpellCheck, replaces: true },
  { id: 'simplify', label: 'Simplify', hint: 'Plain language, jargon defined', icon: Baby, replaces: true },
  { id: 'academic', label: 'Academic tone', hint: 'Formal and impersonal', icon: GraduationCap, replaces: true },
  { id: 'bullets', label: 'Turn into bullets', hint: 'One idea per line', icon: List, replaces: true },
  { id: 'table', label: 'Turn into a table', hint: 'Columns with headers', icon: Table, replaces: true },
  { id: 'math', label: 'Set the maths', hint: 'Real notation and display equations', icon: Sigma, replaces: true },
  { id: 'continue', label: 'Continue writing', hint: 'Keep going from here', icon: ArrowRight, replaces: true, worksOnCaret: true },
  { id: 'explain', label: 'Explain this', hint: 'What it says and what it misses', icon: HelpCircle, replaces: false },
  { id: 'custom', label: 'Custom instruction…', hint: 'Tell it exactly what to do', icon: MessageSquare, replaces: true, worksOnCaret: true },
];

/** How much surrounding text to send as context on either side of a passage. */
export const CONTEXT_CHARS = 1200;
