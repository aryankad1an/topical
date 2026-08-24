import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileQuestion, Loader2, Printer } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { getLessonPlanById, getPublicLessonPlanById, type LessonPlanResponse } from '@/lib/api';
import { documentContent } from '@/lib/documents';
import { formatOf, type DocFormat } from '@/lib/types';
import { MarkdownPreview } from '@/features/preview/MarkdownPreview';
import { LatexPreview } from '@/features/preview/LatexPreview';
import { downloadSource, printPreview } from '@/features/editor/lib/exporters';
import { EmptyState } from '@/components/ui/primitives';

/** What the reader reads out of its own URL. */
export interface ReaderSearch {
  /** Document to open. Absent means there is nothing to show. */
  id?: number;
}

/**
 * The reader's URL contract, declared once — the same treatment `/editor` got.
 *
 * Without it the router types this route's search as empty, so the one
 * `navigate({ to: '/read' })` call site had to escape the type system with
 * `as never`, and the page dug its own id out of `window.location.search`.
 * That hand-read ran in a mount-only effect, so following a second `/read`
 * link while already on the page left the first document on screen.
 */
export const Route = createFileRoute('/read')({
  component: ReaderPage,
  validateSearch: (search: Record<string, unknown>): ReaderSearch => {
    const id = Number(search.id);
    return { id: Number.isFinite(id) && id > 0 ? id : undefined };
  },
});

interface LoadedDocument {
  name: string;
  content: string;
  format: DocFormat;
}

/**
 * Read-only view of a document.
 *
 * Replaces a 318-line page that re-derived a heading hierarchy the editor
 * already stores, and rendered it with markup that existed nowhere else.
 */
function ReaderPage() {
  const { id } = Route.useSearch();
  const [doc, setDoc] = useState<LoadedDocument | null>(null);
  const [loading, setLoading] = useState(true);

  // Keyed on the id, so following a link to another document reloads rather
  // than leaving the previous one on screen under the new URL.
  useEffect(() => {
    if (!id) {
      setDoc(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    (async () => {
      // Try it as one of yours first, then as a published document.
      let result: LessonPlanResponse | { error: string } = await getLessonPlanById(id);
      if ('error' in result) result = await getPublicLessonPlanById(id);
      if (cancelled) return;

      if ('error' in result) {
        toast.error('That document is not available.');
        setDoc(null);
      } else {
        setDoc({
          name: result.name,
          format: formatOf(result.mainTopic),
          content: documentContent(result.topics),
        });
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id]);

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
