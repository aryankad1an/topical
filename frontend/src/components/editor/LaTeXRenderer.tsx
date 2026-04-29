import { useMemo } from 'react';
import katex from 'katex';

interface LaTeXRendererProps { content: string; }

export function LaTeXRenderer({ content }: LaTeXRendererProps) {
  const html = useMemo(() => renderLatex(content), [content]);
  return <div className="latex-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderLatex(src: string): string {
  if (!src.trim()) return '';

  // ── 1. Strip % comments FIRST (before any other processing) ──
  // A % that is NOT preceded by a backslash starts a comment until end of line
  src = src.replace(/(?<!\\)%[^\n]*/g, '');

  // ── 2. Strip preamble / document structure ──
  src = src.replace(/\\documentclass(\[[^\]]*\])?\{[^}]*\}/g, '');
  src = src.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  src = src.replace(/\\begin\{document\}/g, '');
  src = src.replace(/\\end\{document\}/g, '');
  src = src.replace(/\\maketitle/g, '');
  src = src.replace(/\\date\{[^}]*\}/g, '');

  // ── 3. Title / author before we start building HTML ──
  src = src.replace(/\\title\{([^}]*)\}/g, '\x00TITLE\x00$1\x00');
  src = src.replace(/\\author\{([^}]*)\}/g, '\x00AUTHOR\x00$1\x00');

  let html = src;

  // Restore title/author as HTML
  html = html.replace(/\x00TITLE\x00([^\x00]*)\x00/g, '<h1 class="lx-title">$1</h1>');
  html = html.replace(/\x00AUTHOR\x00([^\x00]*)\x00/g, '<p class="lx-author">$1</p>');

  // ── 4. Math environments (must come before text processing) ──
  // display math: equation / align / gather / matrix etc.
  html = html.replace(/\\begin\{(equation|align|gather|multline|eqnarray|array|matrix|pmatrix|bmatrix|vmatrix)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
    (_, _env, math) => renderDisplayMath(math));
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => renderDisplayMath(math));
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => renderDisplayMath(math));

  // inline math
  html = html.replace(/\$([^$\n]+?)\$/g, (_, math) => renderInlineMath(math));
  html = html.replace(/\\\(([^)]+?)\\\)/g, (_, math) => renderInlineMath(math));

  // ── 5. Environments ──
  html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, inner) => {
    const items = inner.split(/\\item\s*/).filter((s: string) => s.trim());
    return '<ul class="lx-list">' + items.map((it: string) => `<li>${it.trim()}</li>`).join('') + '</ul>';
  });
  html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, inner) => {
    const items = inner.split(/\\item\s*/).filter((s: string) => s.trim());
    return '<ol class="lx-list">' + items.map((it: string) => `<li>${it.trim()}</li>`).join('') + '</ol>';
  });
  html = html.replace(/\\begin\{description\}([\s\S]*?)\\end\{description\}/g, (_, inner) => {
    const items = inner.split(/\\item\s*/).filter((s: string) => s.trim());
    return '<dl class="lx-list">' + items.map((it: string) => {
      const m = it.match(/^\[([^\]]*)\]\s*([\s\S]*)/);
      return m ? `<dt><strong>${m[1]}</strong></dt><dd>${m[2].trim()}</dd>` : `<dd>${it.trim()}</dd>`;
    }).join('') + '</dl>';
  });
  html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, '<blockquote class="lx-quote">$1</blockquote>');
  html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre class="lx-verbatim">$1</pre>');
  html = html.replace(/\\begin\{lstlisting\}(\[[^\]]*\])?([\s\S]*?)\\end\{lstlisting\}/g, '<pre class="lx-verbatim">$2</pre>');
  html = html.replace(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/g,
    '<div class="lx-abstract"><h2 class="lx-subsection">Abstract</h2><p class="lx-p">$1</p></div>');

  // figure
  html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, (_, _opt, inner) => {
    const imgMatch = inner.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
    const capMatch = inner.match(/\\caption\{([^}]*)\}/);
    const imgTag = imgMatch ? `<img src="${imgMatch[2]}" class="lx-img" alt="${capMatch?.[1] || ''}" />` : '';
    const capTag = capMatch ? `<figcaption class="lx-caption">${capMatch[1]}</figcaption>` : '';
    return `<figure class="lx-figure">${imgTag}${capTag}</figure>`;
  });

  // tabular
  html = html.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_, inner) => {
    const rows = inner.split(/\\\\[\s]*/).filter((r: string) => r.trim() && !r.trim().startsWith('\\hline'));
    const tableRows = rows.map((row: string) => {
      const cells = row.split('&').map((c: string) => `<td class="lx-td">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="lx-table"><tbody>${tableRows}</tbody></table>`;
  });

  // ── 6. Headings ──
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2 class="lx-section">$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 class="lx-subsection">$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 class="lx-subsubsection">$1</h4>');
  html = html.replace(/\\paragraph\{([^}]*)\}/g, '<h5 class="lx-paragraph">$1</h5>');
  html = html.replace(/\\subparagraph\{([^}]*)\}/g, '<h6 class="lx-paragraph">$1</h6>');

  // ── 7. Text formatting ──
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\texttt\{([^}]*)\}/g, '<code class="lx-code">$1</code>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\textsc\{([^}]*)\}/g, '<span style="font-variant:small-caps">$1</span>');
  html = html.replace(/\\textsuperscript\{([^}]*)\}/g, '<sup>$1</sup>');
  html = html.replace(/\\textsubscript\{([^}]*)\}/g, '<sub>$1</sub>');
  html = html.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<a href="$1" class="lx-link">$2</a>');
  html = html.replace(/\\url\{([^}]*)\}/g, '<a href="$1" class="lx-link">$1</a>');

  // ── 8. Special characters / accents ──
  html = html.replace(/\\&/g, '&amp;');
  html = html.replace(/\\%/g, '%');
  html = html.replace(/\\\$/g, '$');
  html = html.replace(/\\#/g, '#');
  html = html.replace(/\\_/g, '_');
  html = html.replace(/\\\{/g, '{');
  html = html.replace(/\\\}/g, '}');
  html = html.replace(/\\~/g, '~');
  html = html.replace(/\\ldots/g, '…');
  html = html.replace(/\\dots/g, '…');
  html = html.replace(/---/g, '—');
  html = html.replace(/--/g, '–');
  html = html.replace(/``/g, '"');
  html = html.replace(/''/g, '"');

  // ── 9. Misc commands ──
  html = html.replace(/\\hrule/g, '<hr class="lx-hr" />');
  html = html.replace(/\\hline/g, '');
  html = html.replace(/\\newline|\\\\(\s|$)/g, '<br/>');
  html = html.replace(/\\noindent\s*/g, '');
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\ref\{[^}]*\}/g, '');
  html = html.replace(/\\centering/g, '');
  html = html.replace(/\\clearpage|\\pagebreak|\\newpage/g, '<hr class="lx-hr" />');
  html = html.replace(/\\tableofcontents/g, '');
  html = html.replace(/~+/g, '\u00A0');
  // strip remaining unknown commands with no args
  html = html.replace(/\\[a-zA-Z]+\s*/g, '');

  // ── 10. Wrap paragraphs ──
  html = html.replace(/\n{2,}/g, '</p><p class="lx-p">');
  html = `<p class="lx-p">${html}</p>`;
  html = html.replace(/<p class="lx-p">\s*<\/p>/g, '');

  return html;
}

function renderDisplayMath(math: string): string {
  try {
    return `<div class="lx-math-block">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false, trust: true })}</div>`;
  } catch {
    return `<div class="lx-math-block lx-err">${math.trim()}</div>`;
  }
}

function renderInlineMath(math: string): string {
  try {
    return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false, trust: true });
  } catch {
    return `<span class="lx-err">${math.trim()}</span>`;
  }
}
