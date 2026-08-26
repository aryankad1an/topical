/**
 * Escaping for the places this app builds HTML as a string.
 *
 * Three of them do: the LaTeX renderer, the print/PDF template, and the
 * editor's syntax mirror. Each had grown its own copy, and they had already
 * drifted — the mirror's escaped `&<>` but not `"`, which is only safe for as
 * long as nobody interpolates it into an attribute. One implementation, the
 * strict one, so that stops being a thing anyone has to know.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

/** Make `value` safe to drop into element text *or* a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ENTITIES[character]);
}
