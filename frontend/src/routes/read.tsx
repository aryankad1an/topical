import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileQuestion, Loader2, Printer } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { getLessonPlanById, getPublicLessonPlanById, type LessonPlanResponse } from '@/lib/api';
import { stripFrontmatter } from '@/lib/utils';
import { formatOf, type DocFormat } from '@/lib/types';
import { MarkdownPreview } from '@/features/preview/MarkdownPreview';
import { LatexPreview } from '@/features/preview/LatexPreview';
import { downloadSource, printPreview } from '@/features/editor/lib/exporters';
import { EmptyState } from '@/components/ui/primitives';

export const Route = createFileRoute('/read')({ component: ReaderPage });

/**
 * Read-only view of a document.
 *
 * Replaces a 318-line page that re-derived a heading hierarchy the editor
 * already stores, and rendered it with markup that existed nowhere else.
 */
function ReaderPage() {
  const [doc, setDoc] = useState<{ name: string; content: string; format: DocFormat } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get('id'));
    if (!id) {
      setLoading(false);
      return;
    }

    (async () => {
      // Try it as one of yours first, then as a published document.
      let result: LessonPlanResponse | { error: string } = await getLessonPlanById(id);
      if ('error' in result) result = await getPublicLessonPlanById(id);
      if ('error' in result) {
        toast.error('That document is not available.');
        setLoading(false);
        return;
      }

      setDoc({
        name: result.name,
        format: formatOf(result.mainTopic),
        content: result.topics
          .filter(topic => topic.mdxContent?.trim())
          .map(topic => stripFrontmatter(topic.mdxContent))
          .join('\n\n'),
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent-500)' }} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="page-shell page-shell--narrow">
        <EmptyState
          icon={FileQuestion}
          title="Document not found"
          description="It may have been unpublished, or the link may be wrong."
          action={<Link to="/community" className="btn-subtle btn-subtle--pill px-4 py-2">Browse the community</Link>}
        />
      </div>
    );
  }

  return (
    <div className="page-shell page-shell--narrow">
      <div className="page-header">
        <div className="min-w-0">
          <span className="eyebrow"><span className="eyebrow-dot" />{doc.format === 'latex' ? 'LaTeX' : 'MDX'}</span>
          <h1 className="font-brand text-3xl tracking-tight gradient-text mt-3">{doc.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/community" className="btn-subtle btn-subtle--pill px-3 py-2">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <button className="btn-subtle btn-subtle--pill px-3 py-2" onClick={() => downloadSource(doc.name, doc.content, doc.format)}>
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button className="btn-subtle btn-subtle--pill px-3 py-2" onClick={printPreview}>
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="reader-sheet doc-sheet" data-format={doc.format}>
        {doc.format === 'latex'
          ? <LatexPreview content={doc.content} showIssues={false} />
          : <MarkdownPreview content={doc.content} />}
      </div>
    </div>
  );
}
