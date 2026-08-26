/**
 * PDF export: build a real document, then hand it to the print engine.
 *
 * What this replaces printed the *application*. A `@media print` block hid the
 * chrome and then spent thirty `!important` declarations trying to talk the
 * editor's shell — nested flex columns, `height: 100vh`, `overflow: hidden`,
 * a container query — back into something that flows across pages. It mostly
 * did not: the layout that makes an editor work on screen is exactly the
 * layout that cannot paginate, and undoing it at print time is a fight that
 * never fully ends.
 *
 * So this does not print the app. It builds a separate document in an
 * isolated iframe containing only the rendered prose and a stylesheet written
 * for paper, and prints that. The rendered HTML is reused as-is, so KaTeX
 * stays typeset and code stays highlighted; nothing is re-parsed and nothing
 * is rasterised, which means the text in the PDF is real selectable text.
 */

import { escapeHtml } from '@/lib/html';

export type PdfTheme = 'paper' | 'plain' | 'ink';
export type PdfAccent = 'terracotta' | 'indigo' | 'forest' | 'none';
export type PdfPage = 'a4' | 'letter';
export type PdfMargin = 'narrow' | 'normal' | 'wide';
export type PdfFace = 'serif' | 'sans';

export interface PdfOptions {
  theme: PdfTheme;
  accent: PdfAccent;
  page: PdfPage;
  margin: PdfMargin;
  face: PdfFace;
  /** A first page carrying the title, the author and the date. */
  titlePage: boolean;
  /** Keep the syntax colours in code blocks, or set them in one ink. */
  colourCode: boolean;
  /**
   * Drop the page margin to zero and take the margins as padding instead.
   *
   * The browser draws its own date, URL and page count inside the @page
   * margin, and no stylesheet can turn that off — it is a checkbox in the
   * print dialog. Removing the margin removes the strip they are drawn in,
   * which is the only lever a document has over them.
   *
   * The cost is real and is why this is not the default: padding applies to a
   * fragmented box's first and last fragment only, so on a multi-page export
   * the pages in between lose their top and bottom breathing room.
   */
  edgeToEdge: boolean;
}

export const PDF_DEFAULTS: PdfOptions = {
  theme: 'paper',
  accent: 'terracotta',
  page: 'a4',
  margin: 'normal',
  face: 'serif',
  titlePage: true,
  colourCode: true,
  edgeToEdge: false,
};

/* Themes are declared as literal hex rather than read from the app's tokens.
   A PDF is a file that outlives the session it was made in: it must not change
   because somebody later re-themed the application, and it must not resolve a
   colour against a dark-mode variable that does not exist on paper. */
const THEMES: Record<PdfTheme, { bg: string; ink: string; ink2: string; faint: string; rule: string; well: string }> = {
  /* `bg` is only ever used by a theme that bleeds. Paper and Plain differ in
     their *ink*, not their paper — a printed page is white, and tinting the
     page area a shade off-white only reveals where the margin starts. */
  paper: { bg: '#ffffff', ink: '#1f1c17', ink2: '#403a32', faint: '#6b6459', rule: '#ddd8cc', well: '#f6f4ee' },
  plain: { bg: '#ffffff', ink: '#000000', ink2: '#1a1a1a', faint: '#555555', rule: '#cccccc', well: '#f5f5f5' },
  ink:   { bg: '#191714', ink: '#f5f2ec', ink2: '#ddd8cf', faint: '#a49c8e', rule: '#3a352e', well: '#23211d' },
};

const ACCENTS: Record<PdfAccent, string> = {
  terracotta: '#c25e38',
  indigo: '#4a5b8c',
  forest: '#3d6b4a',
  none: 'currentColor',
};

const MARGINS: Record<PdfMargin, string> = {
  narrow: '12mm',
  normal: '20mm',
  wide: '30mm',
};

const FACES: Record<PdfFace, string> = {
  serif: "'Newsreader', 'Iowan Old Style', Charter, Georgia, serif",
  sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
};

/**
 * Every stylesheet the app is currently using, as markup for the iframe.
 *
 * Both forms have to be handled: Vite injects `<style>` elements in
 * development and emits a bundled `<link>` in production, and KaTeX and
 * highlight.js arrive through whichever of the two is in play. Missing them
 * would print equations as loose spans and code as flat text.
 */
function collectStyles(): string {
  const parts: string[] = [];
  document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style').forEach(node => {
    if (node instanceof HTMLLinkElement) {
      if (node.href) parts.push(`<link rel="stylesheet" href="${node.href}">`);
    } else if (node.textContent) {
      parts.push(`<style>${node.textContent}</style>`);
    }
  });
  return parts.join('\n');
}

function paperCss(options: PdfOptions): string {
  const t = THEMES[options.theme];
  const accent = ACCENTS[options.accent];
  /* A dark page has to bleed or it prints as a rectangle in a white frame.
     A light page bleeds only if the reader has asked to be rid of the
     browser's header and footer. */
  const bleed = options.theme === 'ink' || options.edgeToEdge;
  return `
    /* ── Why the page is laid out two different ways ──
       A page background paints the *page area* only — the strip inside the
       @page margin stays paper-white, and it is also where the browser prints
       its own date/URL header. Painting a colour with a margin therefore does
       not produce a coloured page; it produces a coloured rectangle in a white
       frame, which is exactly the bezel this used to have.

       So: a light theme paints nothing at all and lets the sheet be the sheet,
       which is what a printed document is. The dark theme drops the @page
       margin to zero and takes its margins as padding instead, so the colour
       genuinely reaches all four edges. Zero @page margin also suppresses the
       browser's header and footer, which is the only way a page can. */
    @page {
      size: ${options.page === 'a4' ? 'A4' : 'letter'};
      margin: ${bleed ? '0' : MARGINS[options.margin]};
    }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    /* Paper has no scrollbars, so every scroll container in the copied app CSS
       is a clipping box: .md-code is overflow: hidden, and .md-code pre,
       .md-table-wrap, .lx-table-wrap and the LaTeX blocks are all
       overflow-x: auto. On screen that hides an overflow behind a scrollbar;
       in print it simply cuts the content off at the edge of the box, which is
       what "some pages look cut off" was. Anything that scrolls must overflow
       instead, so at least it is visible and the failure is obvious. */
    #pdf *, #pdf *::before, #pdf *::after { overflow: visible !important; }
    html, body {
      margin: 0;
      padding: 0;
      /* White, stated rather than omitted: the app's own stylesheet is copied
         in for KaTeX and it sets body to the page cream, so leaving this out
         does not leave the sheet unpainted — it leaves it cream inside a white
         margin, which is the bezel again. */
      background: ${bleed ? t.bg : '#ffffff'};
      color: ${t.ink2};
    }
    ${bleed ? `body { padding: ${MARGINS[options.margin]}; }` : ''}
    /* The sheet is a page now, so every screen constraint on it is dropped:
       the container-query measure, the fixed padding, the split-view rules. */
    #pdf {
      max-width: none;
      width: 100%;
      padding: 0;
      margin: 0;
      font-family: ${FACES[options.face]};
      font-size: 11pt;
      line-height: 1.62;
      color: ${t.ink2};
      font-optical-sizing: auto;
    }
    /* The copied markup still carries the app's own document wrappers, and
       .md-body sets its own 17px, which a size inherited from #pdf cannot
       override. Named explicitly so the whole subtree is at paper size. */
    #pdf .md-body,
    #pdf .lx-doc {
      font-family: ${FACES[options.face]};
      font-size: 11pt;
      line-height: 1.62;
      color: ${t.ink2};
      max-width: none;
    }
    #pdf h1, #pdf h2, #pdf h3,
    #pdf h4, #pdf h5, #pdf h6 {
      font-family: ${FACES[options.face]};
      color: ${t.ink};
      line-height: 1.22;
      letter-spacing: -0.012em;
      /* A heading alone at the foot of a page is the single most common way a
         printed document looks unedited. */
      break-after: avoid-page;
      page-break-after: avoid;
      break-inside: avoid;
    }
    #pdf h1 { font-size: 20pt; margin: 0 0 0.6em; }
    #pdf h2 {
      font-size: 15pt;
      margin: 1.6em 0 0.5em;
      padding-bottom: 0.25em;
      border-bottom: 0.6pt solid ${t.rule};
    }
    #pdf h3 { font-size: 12.5pt; margin: 1.35em 0 0.4em; }
    #pdf h4 { font-size: 11.5pt; margin: 1.2em 0 0.35em; }
    #pdf p, #pdf li { orphans: 2; widows: 2; }
    #pdf p { margin: 0 0 0.75em; }
    #pdf strong { color: ${t.ink}; }
    #pdf a { color: ${accent}; text-decoration: none; border-bottom: 0.5pt solid ${accent}; }
    #pdf blockquote {
      margin: 1em 0;
      padding: 0.1em 0 0.1em 1em;
      border-left: 2pt solid ${accent};
      color: ${t.faint};
    }
    #pdf hr { border: 0; border-top: 0.6pt solid ${t.rule}; margin: 1.6em 0; }
    /* Tables and figures are single objects; splitting one across a page break
       separates a row from the header that names its columns. */
    #pdf table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      font-size: 9.5pt;
      font-variant-numeric: tabular-nums;
      /* avoid, which is what this said, is unsatisfiable for a table taller
         than the page: the engine moves it to a fresh page, it still does not
         fit, and the remainder is dropped. A long table has to split — and
         when it does the header row repeats, so the second half still has
         columns you can name. */
      break-inside: auto;
    }
    #pdf thead { display: table-header-group; }
    #pdf tr { break-inside: avoid; }
    #pdf th, #pdf td {
      border: 0.5pt solid ${t.rule};
      padding: 5pt 7pt;
      text-align: left;
    }
    #pdf th { background: ${t.well}; color: ${t.ink}; font-weight: 600; }
    #pdf pre, #pdf .md-code {
      background: ${t.well};
      border: 0.5pt solid ${t.rule};
      border-radius: 3pt;
      padding: 8pt 10pt;
      margin: 1em 0;
      overflow: visible;
      /* Same reasoning as the table: a listing longer than a page cannot be
         kept whole, and asking for it loses whatever did not fit. Individual
         lines still stay intact. */
      break-inside: auto;
    }
    #pdf pre, #pdf code, #pdf kbd {
      font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
      font-size: 8.5pt;
      /* Screen code scrolls sideways; paper has no sideways, so it wraps or it
         is silently cut off at the margin. */
      white-space: pre-wrap;
      word-break: break-word;
    }
    /* The bundled highlight theme is a light one — its colours are dark greys
       and dark blues, chosen to sit on white. On the dark page they land on a
       near-black well and the code becomes invisible, which is what the first
       Ink export produced. So a dark page always neutralises them, whatever
       the colour-in-code setting says; the setting can only turn colour off,
       never on where it would be unreadable. */
    ${(options.colourCode && !bleed) ? '' : `#pdf pre *, #pdf code * { color: ${t.ink2} !important; font-style: normal !important; }`}
    /* The rendered code block carries the editor's own chrome — a language
       label and a copy button. Neither is a thing on paper. */
    #pdf .md-code-bar { display: none !important; }
    #pdf .md-code { padding-top: 8pt; }
    #pdf :not(pre) > code {
      background: ${t.well};
      border: 0.5pt solid ${t.rule};
      border-radius: 2pt;
      padding: 0.5pt 3pt;
      color: ${t.ink};
    }
    #pdf img { max-width: 100%; height: auto; break-inside: avoid; }
    #pdf .katex { font-size: 1.02em; }
    #pdf .katex-display { margin: 0.9em 0; break-inside: avoid; }
    /* Screen affordances that mean nothing on paper. */
    #pdf .md-anchor,
    #pdf .md-copy,
    #pdf .lx-issues { display: none !important; }
    /* The editor's "which section is selected" band is a screen state. */
    #pdf .doc-focus {
      background: none !important;
      border-left: 0 !important;
      margin-left: 0 !important;
      padding-left: 0 !important;
    }

    #pdf-cover {
      break-after: page;
      page-break-after: always;
      /* vh is a viewport unit and a sheet of paper is not a viewport; it
         resolved against whatever the print engine guessed. Millimetres are
         the unit the page is actually measured in. */
      padding-top: 60mm;
    }
    #pdf-cover h1 {
      font-family: ${FACES[options.face]};
      font-size: 30pt;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: ${t.ink};
      margin: 0 0 0.5em;
    }
    #pdf-cover .pdf-cover-rule { width: 44pt; height: 2.5pt; background: ${accent}; margin-bottom: 14pt; }
    #pdf-cover .pdf-cover-meta { font-size: 10pt; color: ${t.faint}; }
  `;
}

export interface PdfDocumentInfo {
  title: string;
  author?: string | null;
  /** The rendered preview's inner HTML — already typeset, already highlighted. */
  html: string;
}

/**
 * Build the document and open the print dialog on it.
 *
 * The iframe is same-origin and written synchronously, so its styles and the
 * webfonts resolve against the page that is already using them. `document.fonts.ready`
 * is awaited before printing because a heading measured in a fallback face and
 * then printed in the real one breaks in the wrong place.
 */
export async function exportPdf(info: PdfDocumentInfo, options: PdfOptions): Promise<void> {
  const frame = document.createElement('iframe');
  // Off-screen rather than `display: none`: a display-none iframe does not lay
  // out, so nothing has a height and the print comes out empty.
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;opacity:0;border:0;pointer-events:none;';
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error('Could not open a document to print into.');
  }

  const cover = options.titlePage
    ? `<header id="pdf-cover">
         <div class="pdf-cover-rule"></div>
         <h1>${escapeHtml(info.title)}</h1>
         <p class="pdf-cover-meta">${info.author ? escapeHtml(info.author) + ' · ' : ''}${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
       </header>`
    : '';

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>${escapeHtml(info.title)}</title>
    ${collectStyles()}
    <style>${paperCss(options)}</style>
  </head><body>${cover}<article id="pdf">${info.html}</article></body></html>`);
  doc.close();

  try {
    await (doc.fonts?.ready ?? Promise.resolve());
  } catch {
    // A font that never resolves is not a reason to refuse to print.
  }
  // One frame, so the final layout after fonts land is the one that prints.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  frame.contentWindow?.focus();
  frame.contentWindow?.print();

  // Chromium's print() returns once the dialog closes; Safari's returns
  // immediately, so the frame has to outlive the call either way.
  window.setTimeout(() => frame.remove(), 60_000);
}
