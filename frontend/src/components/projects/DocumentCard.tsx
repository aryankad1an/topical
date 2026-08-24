import { FileType2, FileCode2, Eye, Pencil, Trash2, Globe, Lock, Users } from 'lucide-react';
import { docTypeVars } from '@/components/ui/primitives';
import { formatOf } from '@/lib/types';

export interface DocLike {
  id?: number;
  name: string;
  mainTopic: string;
  // Nullable to match what the API actually returns, rather than forcing
  // every call site to coerce.
  isPublic?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  authorUsername?: string | null;
  coAuthorUsernames?: string[];
  topics?: { mdxContent?: string }[];
}


/** All the document's text, for previews and counts. */
function docText(doc: DocLike): string {
  return (doc.topics ?? []).map(t => t.mdxContent ?? '').join('\n');
}

export function wordCount(doc: DocLike): number {
  const t = docText(doc).replace(/[#*`_>\-[\]()]/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
}

/** One line of the miniature: either a heading or a run of body text. */
type PreviewLine = { text: string; heading: boolean };

/**
 * Strip the markup from one line, leaving what a reader would actually see.
 *
 * Both formats at once, because a document is one or the other and the card
 * does not know which until it looks at `mainTopic` — and running the wrong
 * stripper over the other format is worse than running both over either.
 */
function stripMarkup(line: string): string {
  return line
    // LaTeX: \section{Foundations} → Foundations. Sectioning commands carry
    // the text a reader wants; everything else is scaffolding.
    .replace(/\\(?:sub)*section\*?\{([^}]*)\}/g, '$1')
    .replace(/\\(?:textbf|textit|emph|texttt|mbox)\{([^}]*)\}/g, '$1')
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, '')
    .replace(/\$[^$]*\$/g, '')            // inline maths reads as noise at 9px
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, '')
    // Markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[*_`~]/g, '')
    .replace(/\{|\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The document's own opening, as lines of real text.
 *
 * The card used to draw grey bars whose *widths* came from the real paragraph
 * lengths — a silhouette of the document rather than the document. Every card
 * therefore looked the same from more than a foot away, which is exactly the
 * distance a grid of cards is read from. Showing the actual first heading and
 * first few sentences makes each card recognisable as the thing it opens.
 */
function previewContent(doc: DocLike, max = 7): PreviewLine[] {
  const out: PreviewLine[] = [];

  for (const raw of docText(doc).split('\n')) {
    if (out.length >= max) break;
    const line = raw.trim();
    if (!line || line.startsWith('```') || line.startsWith('---')) continue;

    const isHeading =
      /^#{1,6}\s/.test(line) || /^\\(?:sub)*section\*?\{/.test(line);
    const text = stripMarkup(line.replace(/^#{1,6}\s+/, ''));
    if (!text) continue;

    // Two headings in a row is a table of contents, not a preview of prose.
    if (isHeading && out.length && out[out.length - 1].heading) continue;
    out.push({ text, heading: isHeading });
  }

  return out;
}

interface Props {
  doc: DocLike;
  isAuthor: boolean;
  onRead: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  formatDate: (d: string | null) => string;
  children?: React.ReactNode;
}

export function DocumentCard({ doc, isAuthor, onRead, onEdit, onDelete, formatDate, children }: Props) {
  const type = formatOf(doc.mainTopic);
  const isLatex = type === 'latex';
  const Icon = isLatex ? FileCode2 : FileType2;
  const preview = previewContent(doc);
  const words = wordCount(doc);

  return (
    <div className="doc-card group" style={docTypeVars(type)}>
      <span className="doc-badge">{isLatex ? 'LaTeX' : 'MDX'}</span>

      {/* A miniature of the document, set in its own words. Hidden from
          assistive tech: the same text is announced properly by the title and
          metadata below, and reading a truncated duplicate first is worse
          than not reading it. */}
      <div className="doc-thumb" aria-hidden="true">
        <div className="doc-thumb-title">{doc.name}</div>
        {preview.length > 0 ? (
          <div className="doc-thumb-doc">
            {preview.map((line, i) => (
              <p key={i} className={line.heading ? 'doc-thumb-h' : 'doc-thumb-p'}>
                {line.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="doc-thumb-empty">Empty document — open it to start writing.</p>
        )}
      </div>

      <div className="doc-body">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: 'var(--doc-accent-soft)', border: '1px solid var(--doc-accent-line)' }}>
            <Icon className="h-3.5 w-3.5" style={{ color: 'var(--doc-accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--ink)] truncate">{doc.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--ink-faint)]">
              <span>{formatDate(doc.updatedAt ?? doc.createdAt ?? null)}</span>
              {words > 0 && <><span className="text-[var(--ink-ghost)]">·</span><span>{words.toLocaleString()} words</span></>}
            </div>
          </div>
          {isAuthor && doc.id != null && (
            <button onClick={() => onDelete(doc.id!)} aria-label={`Delete ${doc.name}`}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--ink-ghost)] hover:text-[var(--status-danger)] hover:bg-[var(--status-danger)] transition-all shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--ink-faint)] px-2 py-0.5 rounded-full"
            style={{ background: 'var(--ink-a04)', border: '1px solid var(--line-soft)' }}>
            {doc.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {doc.isPublic ? 'Public' : 'Private'}
          </span>
          {doc.coAuthorUsernames && doc.coAuthorUsernames.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10.5px] text-[var(--ink-faint)] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--ink-a02)', border: '1px solid var(--line-soft)' }}>
              <Users className="h-2.5 w-2.5" />
              {doc.coAuthorUsernames.length + 1}
            </span>
          )}
          {children}
        </div>

        {doc.id != null && (
          <div className="doc-actions">
            <button className="doc-btn" onClick={() => onRead(doc.id!)}>
              <Eye className="h-3.5 w-3.5" /> Read
            </button>
            <button className="doc-btn doc-btn--primary" onClick={() => onEdit(doc.id!)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentRow({ doc, isAuthor, onRead, onEdit, onDelete, formatDate }: Props) {
  const type = formatOf(doc.mainTopic);
  const isLatex = type === 'latex';
  const Icon = isLatex ? FileCode2 : FileType2;
  const words = wordCount(doc);

  return (
    <div className="doc-row group" style={docTypeVars(type)}>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--doc-accent-soft)', border: '1px solid var(--doc-accent-line)' }}>
        <Icon className="h-4 w-4" style={{ color: 'var(--doc-accent)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[var(--ink)] truncate">{doc.name}</h3>
          <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'var(--doc-accent-soft)', color: 'var(--doc-accent)' }}>
            {isLatex ? 'TEX' : 'MDX'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--ink-ghost)] mt-0.5">
          <span>{formatDate(doc.updatedAt ?? doc.createdAt ?? null)}</span>
          {words > 0 && <><span className="text-[var(--ink-ghost)]">·</span><span>{words.toLocaleString()} words</span></>}
          <span className="text-[var(--ink-ghost)]">·</span>
          <span className="inline-flex items-center gap-1">
            {doc.isPublic ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
            {doc.isPublic ? 'Public' : 'Private'}
          </span>
        </div>
      </div>

      {doc.id != null && (
        <div className="flex items-center gap-2 shrink-0">
          <button className="doc-btn px-3" style={{ flex: 'none' }} onClick={() => onRead(doc.id!)}>
            <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Read</span>
          </button>
          <button className="doc-btn doc-btn--primary px-3" style={{ flex: 'none' }} onClick={() => onEdit(doc.id!)}>
            <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Edit</span>
          </button>
          {isAuthor && (
            <button onClick={() => onDelete(doc.id!)} aria-label={`Delete ${doc.name}`}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--ink-ghost)] hover:text-[var(--status-danger)] transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
