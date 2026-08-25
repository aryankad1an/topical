import { memo, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { renderLatex } from './latex/render';

interface Props {
  content: string;
  /** Shows the parser's complaints under the document. */
  showIssues?: boolean;
}

/**
 * A rendered LaTeX document: numbered sections, resolved cross-references,
 * theorem blocks, footnotes and a references list — laid out like a paper
 * rather than like a web page.
 */
/** Memoised for the same reason as `MarkdownPreview`: the split divider must
 *  not re-parse the document on every frame of a drag. */
function LatexPreviewInner({ content, showIssues = true }: Props) {
  const doc = useMemo(() => renderLatex(content), [content]);
  const [issuesOpen, setIssuesOpen] = useState(false);

  return (
    <article className="lx-doc">
      {(doc.title || doc.author || doc.date) && (
        <header className="lx-titleblock">
          {doc.title && <h1 className="lx-title" dangerouslySetInnerHTML={{ __html: doc.title }} />}
          {doc.author && <p className="lx-author" dangerouslySetInnerHTML={{ __html: doc.author }} />}
          {doc.date && <p className="lx-date" dangerouslySetInnerHTML={{ __html: doc.date }} />}
        </header>
      )}

      <div dangerouslySetInnerHTML={{ __html: doc.html }} />

      {showIssues && doc.issues.length > 0 && (
        <div className="lx-issues" data-open={issuesOpen}>
          <button className="lx-issues-head" onClick={() => setIssuesOpen(o => !o)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {doc.issues.length} {doc.issues.length === 1 ? 'issue' : 'issues'} in this document
            <ChevronDown className="h-3.5 w-3.5 lx-issues-chevron" />
          </button>
          {issuesOpen && (
            <ul className="lx-issues-list">
              {doc.issues.map((issue, i) => (
                <li key={i}>
                  {issue.message}
                  {issue.source && <code>{issue.source}</code>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

export const LatexPreview = memo(LatexPreviewInner);
