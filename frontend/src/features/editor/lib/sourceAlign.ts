/**
 * Finding the source character behind a point in the rendered document.
 *
 * `data-line` gets a click to the right *block* — the paragraph, heading or
 * list it landed in. That is where a jump used to stop, and it is not enough:
 * clicking the last word of a twelve-line paragraph put the caret on its
 * first character, which reads as the editor scrolling somewhere arbitrary.
 *
 * Getting to the character needs a second step, and it cannot be a source map:
 * the rendered text is not a transformation of the source with stable offsets,
 * it is a *different string* — `**bold**` became `bold`, `\section{Intro}`
 * became `Intro`, `--` became an en dash, and a KaTeX formula became a tree of
 * spans. What the two do share is their visible characters, in order. So the
 * rendered prefix (everything from the start of the block up to the click) is
 * walked against the block's source, matching one visible character at a time
 * and stepping over anything in the source that does not line up — which is
 * exactly the markup. Where the prefix runs out is where the caret goes.
 *
 * Approximate by construction, and deliberately so: it degrades to "a few
 * characters off, inside the right word" rather than failing, which is the
 * behaviour you want from a navigation aid.
 */

/**
 * How far ahead in the source to hunt for the next rendered character.
 *
 * Bounds the cost, and bounds the damage: a rendered character with no source
 * counterpart (a generated bullet, a substituted glyph) is skipped after this
 * many misses rather than dragging the alignment to the end of the document.
 * Comfortably longer than any run of markup — `\begin{itemize}` and a
 * reference-style link are the long ones, and both are well under it.
 */
const LOOKAHEAD = 96;

/**
 * Canonical form of one visible character.
 *
 * The renderer substitutes typography the source spells in ASCII, so those
 * have to fold back together or alignment breaks at the first em dash. Case is
 * folded too, for `\textsc` and CSS `text-transform`, which change how a
 * character looks without changing which source character it came from.
 */
function canon(ch: string): string {
  switch (ch) {
    case '–':
    case '—':
      return '-';
    case '‘':
    case '’':
      return "'";
    case '“':
    case '”':
      return '"';
    case ' ':
      return ' ';
    default:
      return ch.toLowerCase();
  }
}

function isSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ' ';
}

/**
 * How far into `source` the visible text of `prefix` reaches.
 *
 * `source` starts at the block the click landed in and runs to the end of the
 * document — the walk stops as soon as the prefix is consumed, so it stays
 * inside the block on its own without needing to be told where the block ends.
 */
export function alignPrefixToSource(source: string, prefix: string): number {
  let si = 0;
  let ri = 0;

  while (ri < prefix.length) {
    const rendered = prefix[ri];

    // One rendered space stands for any run of source whitespace: HTML
    // collapses runs, and a source newline inside a paragraph renders as a
    // single space.
    if (isSpace(rendered)) {
      while (si < source.length && isSpace(source[si])) si++;
      ri++;
      continue;
    }

    const target = canon(rendered);
    const limit = Math.min(si + LOOKAHEAD, source.length);
    let found = -1;
    for (let k = si; k < limit; k++) {
      if (canon(source[k]) === target) {
        found = k;
        break;
      }
    }

    // No counterpart within reach: a generated character. Drop it and keep
    // the source position, rather than letting it drag the walk forward.
    if (found === -1) {
      ri++;
      continue;
    }

    si = found + 1;
    ri++;
  }

  return si;
}

/**
 * Parts of the rendered output that no source character produced.
 *
 * Section and equation numbers, caption and bibliography labels, heading
 * anchors and footnote arrows are all composed by the renderer from counters.
 * Left in, they are characters the walk above would hunt for in the source and
 * occasionally find — a section number `1` matching some unrelated digit — so
 * they are cut out before the walk rather than tolerated during it.
 *
 * `.katex-mathml` is the same problem in a different form: KaTeX emits every
 * formula twice, once as MathML for screen readers and once as styled HTML,
 * and the MathML carries an `<annotation>` holding the original TeX. Reading
 * both would count each formula's text two or three times over.
 */
const GENERATED = '.katex-mathml, .lx-num, .lx-eq-num, .lx-caption-label, .lx-bib-num, .lx-fn-back, .md-anchor';

/** Where a caret would land for a viewport point, as a DOM node and offset. */
function caretAtPoint(x: number, y: number): { node: Node; offset: number } | null {
  // Two names for the same thing: the standard one, and WebKit's original.
  const withPosition = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (typeof withPosition.caretPositionFromPoint === 'function') {
    const position = withPosition.caretPositionFromPoint(x, y);
    return position ? { node: position.offsetNode, offset: position.offset } : null;
  }
  const withRange = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof withRange.caretRangeFromPoint === 'function') {
    const range = withRange.caretRangeFromPoint(x, y);
    return range ? { node: range.startContainer, offset: range.startOffset } : null;
  }
  return null;
}

/**
 * The block's visible text from its start up to `(x, y)`.
 *
 * Returns the whole block's text when the point cannot be resolved to a
 * character — a click on padding between paragraphs, say — which aligns to the
 * block's end rather than failing outright.
 */
export function renderedPrefixAt(block: Element, x: number, y: number): string {
  const caret = caretAtPoint(x, y);
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(GENERATED)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });

  let prefix = '';
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const text = node.textContent ?? '';
    if (caret && node === caret.node) return prefix + text.slice(0, caret.offset);
    prefix += text;
  }
  return prefix;
}
