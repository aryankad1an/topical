import { useMemo } from 'react';
import katex from 'katex';

interface LaTeXRendererProps {
  content: string;
}

/**
 * Renders LaTeX source as formatted HTML using KaTeX.
 * Handles \section, \subsection, lists, math environments, etc.
 */
export function LaTeXRenderer({ content }: LaTeXRendererProps) {
  const html = useMemo(() => renderLatex(content), [content]);
  return <div className="latex-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderLatex(src: string): string {
  if (!src.trim()) return '';

  let html = escapeHtml(src);

  // --- strip preamble noise ---
  html = html.replace(/\\documentclass\{[^}]*\}/g, '');
  html = html.replace(/\\usepackage(\[[^\]]*\])?\{[^}]*\}/g, '');
  html = html.replace(/\\begin\{document\}/g, '');
  html = html.replace(/\\end\{document\}/g, '');
  html = html.replace(/\\title\{([^}]*)\}/g, '<h1 class="lx-title">$1</h1>');
  html = html.replace(/\\author\{([^}]*)\}/g, '<p class="lx-author">$1</p>');
  html = html.replace(/\\date\{([^}]*)\}/g, '');
  html = html.replace(/\\maketitle/g, '');

  // --- headings ---
  html = html.replace(/\\section\*?\{([^}]*)\}/g, '<h2 class="lx-section">$1</h2>');
  html = html.replace(/\\subsection\*?\{([^}]*)\}/g, '<h3 class="lx-subsection">$1</h3>');
  html = html.replace(/\\subsubsection\*?\{([^}]*)\}/g, '<h4 class="lx-subsubsection">$1</h4>');
  html = html.replace(/\\paragraph\{([^}]*)\}/g, '<h5 class="lx-paragraph">$1</h5>');

  // --- text formatting ---
  html = html.replace(/\\textbf\{([^}]*)\}/g, '<strong>$1</strong>');
  html = html.replace(/\\textit\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\underline\{([^}]*)\}/g, '<u>$1</u>');
  html = html.replace(/\\texttt\{([^}]*)\}/g, '<code class="lx-code">$1</code>');
  html = html.replace(/\\emph\{([^}]*)\}/g, '<em>$1</em>');
  html = html.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '<a href="$1" class="lx-link">$2</a>');
  html = html.replace(/\\url\{([^}]*)\}/g, '<a href="$1" class="lx-link">$1</a>');

  // --- environments ---
  // itemize
  html = html.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, inner) => {
    const items = inner.split(/\\item\s*/).filter((s: string) => s.trim());
    return '<ul class="lx-list">' + items.map((it: string) => `<li>${it.trim()}</li>`).join('') + '</ul>';
  });
  // enumerate
  html = html.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, inner) => {
    const items = inner.split(/\\item\s*/).filter((s: string) => s.trim());
    return '<ol class="lx-list">' + items.map((it: string) => `<li>${it.trim()}</li>`).join('') + '</ol>';
  });
  // quote
  html = html.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, '<blockquote class="lx-quote">$1</blockquote>');
  // verbatim
  html = html.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, '<pre class="lx-verbatim">$1</pre>');
  // figure
  html = html.replace(/\\begin\{figure\}(\[[^\]]*\])?([\s\S]*?)\\end\{figure\}/g, (_, _opt, inner) => {
    const imgMatch = inner.match(/\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/);
    const capMatch = inner.match(/\\caption\{([^}]*)\}/);
    const imgTag = imgMatch ? `<img src="${imgMatch[2]}" class="lx-img" alt="${capMatch?.[1] || ''}" />` : '';
    const capTag = capMatch ? `<figcaption class="lx-caption">${capMatch[1]}</figcaption>` : '';
    return `<figure class="lx-figure">${imgTag}${capTag}</figure>`;
  });
  // table (basic)
  html = html.replace(/\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g, (_, inner) => {
    const rows = inner.split(/\\\\\s*/).filter((r: string) => r.trim() && !r.trim().startsWith('\\hline'));
    const tableRows = rows.map((row: string) => {
      const cells = row.split('&').map((c: string) => `<td class="lx-td">${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="lx-table"><tbody>${tableRows}</tbody></table>`;
  });

  // --- display math: $$ ... $$, \[ ... \], equation env ---
  html = html.replace(/\\begin\{(equation|align|gather)\*?\}([\s\S]*?)\\end\{\1\*?\}/g, (_, _env, math) => {
    try { return `<div class="lx-math-block">${katex.renderToString(unescapeHtml(math.trim()), { displayMode: true, throwOnError: false })}</div>`; }
    catch { return `<div class="lx-math-block lx-err">${math.trim()}</div>`; }
  });
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try { return `<div class="lx-math-block">${katex.renderToString(unescapeHtml(math.trim()), { displayMode: true, throwOnError: false })}</div>`; }
    catch { return `<div class="lx-math-block lx-err">${math.trim()}</div>`; }
  });
  html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
    try { return `<div class="lx-math-block">${katex.renderToString(unescapeHtml(math.trim()), { displayMode: true, throwOnError: false })}</div>`; }
    catch { return `<div class="lx-math-block lx-err">${math.trim()}</div>`; }
  });

  // --- inline math: $ ... $ ---
  html = html.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    try { return katex.renderToString(unescapeHtml(math.trim()), { displayMode: false, throwOnError: false }); }
    catch { return `<span class="lx-err">${math.trim()}</span>`; }
  });

  // --- misc ---
  html = html.replace(/\\hrule/g, '<hr class="lx-hr" />');
  html = html.replace(/\\newline|\\\\(\s|$)/g, '<br/>');
  html = html.replace(/\\noindent\s*/g, '');
  html = html.replace(/\\label\{[^}]*\}/g, '');
  html = html.replace(/\\centering/g, '');
  html = html.replace(/~+/g, ' ');

  // --- wrap loose text in paragraphs ---
  html = html.replace(/\n{2,}/g, '</p><p class="lx-p">');
  html = `<p class="lx-p">${html}</p>`;
  html = html.replace(/<p class="lx-p">\s*<\/p>/g, '');

  return html;
}

function escapeHtml(s: string): string {
  return s; // We don't escape since we'll convert to HTML tags; KaTeX handles its own escaping
}
function unescapeHtml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
