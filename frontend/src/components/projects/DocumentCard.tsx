import { useMemo } from 'react';
import { FileType2, FileCode2, ArrowUpRight, Trash2 } from 'lucide-react';
import { Button, IconButton, docTypeVars, Row, Text, DocTypeIcon, Chip } from '@/components/ui';
import { Collaborators } from '@/components/Collaborators';
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
  coAuthorUsernames?: (string | null)[];
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
  /**
   * One action, not two.
   *
   * These cards used to carry "Read" and "Edit" side by side, which asked the
   * reader to choose a mode before they had seen the thing they were choosing
   * for — and offered "Edit" on documents the viewer had no write access to.
   * A project is opened; what you can do with it once it is open is decided
   * from the document and the viewer, not from which button was pressed.
   */
  onOpen: (id: number) => void;
  onDelete: (id: number) => void;
  formatDate: (d: string | null) => string;
  /**
   * The visibility control, supplied by the page because only it knows what a
   * publish costs — the confirmation, the request and the caches to refresh.
   * It leads the metadata row: whether a document is published is the first
   * thing about it that is not on the card already.
   */
  children?: React.ReactNode;
}

export function DocumentCard({ doc, isAuthor, onOpen, onDelete, formatDate, children }: Props) {
  const type = formatOf(doc.mainTopic);
  const isLatex = type === 'latex';
  const Icon = isLatex ? FileCode2 : FileType2;
  /* Keyed on the document, not recomputed per render. Both of these walk the
     whole of the document's text — `previewContent` splits it into lines and
     runs a dozen regexes over each, `wordCount` runs one over all of it — and
     a card re-renders for reasons that have nothing to do with its contents:
     a keystroke in the search field above it, or a route change. On a hundred
     documents that was several milliseconds of regex per keystroke, for text
     that had not changed. */
  const preview = useMemo(() => previewContent(doc), [doc]);
  const words = useMemo(() => wordCount(doc), [doc]);

  return (
    <div className="doc-card group" style={docTypeVars(type)}>
      <span className="doc-badge">{isLatex ? 'LaTeX' : 'MDX'}</span>

      {/* A miniature of the document, set in its own words. Hidden from
          assistive tech: the same text is announced properly by the title and
          metadata below, and reading a truncated duplicate first is worse
          than not reading it.

          It does not repeat the document's name. It used to print it at the
          top in 12px serif, forty pixels above the real title — the same
          string twice on one card, and the copy up here was the one that
          could not truncate gracefully or be clicked. */}
      <div className="doc-thumb" aria-hidden="true">
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
        <Row align="start" gap={2.5}>
          <DocTypeIcon type={type} size="sm" icon={Icon} className="mt-0.5" />
          <div className="flex-1 min-w-0">
            <Text as="h3" size="sm" weight="semibold" tone="ink" truncate>{doc.name}</Text>
            <Row align="center" gap={1.5} className="mt-0.5">
              <Text as="span" size="2xs" tone="faint">{formatDate(doc.updatedAt ?? doc.createdAt ?? null)}</Text>
              {words > 0 && <><Text as="span" size="2xs" tone="ghost" aria-hidden="true">·</Text><Text as="span" size="2xs" tone="faint">{words.toLocaleString()} words</Text></>}
            </Row>
          </div>
          {isAuthor && doc.id != null && (
            /* `.icon-btn--danger`, not a hand-rolled hover: the hover here set
               the icon *and* the background to `--status-danger`, so pointing
               at delete made the bin vanish into a solid red block. The shared
               class tints the well and leaves the icon to read against it. */
            <IconButton size="sm" tone="danger" revealOnHover onClick={() => onDelete(doc.id!)} aria-label={`Delete ${doc.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </Row>

        {/* The document's facts, all at one height — see `--doc-chip-h`. */}
        <div className="doc-meta">
          {children}
          {doc.coAuthorUsernames && doc.coAuthorUsernames.length > 0 && (
            <Collaborators
              authorUsername={doc.authorUsername ?? null}
              coAuthorUsernames={doc.coAuthorUsernames}
            />
          )}
        </div>

        {doc.id != null && (
          <div className="doc-actions">
            <Button variant="secondary" size="md" width="full" onClick={() => onOpen(doc.id!)}>
              Open <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentRow({ doc, isAuthor, onOpen, onDelete, formatDate, children }: Props) {
  const type = formatOf(doc.mainTopic);
  const isLatex = type === 'latex';
  const Icon = isLatex ? FileCode2 : FileType2;
  const words = useMemo(() => wordCount(doc), [doc]);

  return (
    <div className="doc-row group" style={docTypeVars(type)}>
      <DocTypeIcon type={type} icon={Icon} />

      <div className="flex-1 min-w-0">
        <Row align="center" gap={2}>
          <Text as="h3" size="sm" weight="medium" tone="ink" truncate>{doc.name}</Text>
          <Chip size="xs" tone="doc">{isLatex ? 'TEX' : 'MDX'}</Chip>
        </Row>
        <Row align="center" gap={1.5} className="mt-0.5">
          <Text as="span" size="2xs" tone="ghost">{formatDate(doc.updatedAt ?? doc.createdAt ?? null)}</Text>
          {words > 0 && <><Text as="span" size="2xs" tone="ghost" aria-hidden="true">·</Text><Text as="span" size="2xs" tone="ghost">{words.toLocaleString()} words</Text></>}
        </Row>
      </div>

      {doc.id != null && (
        <Row align="center" gap={2} className="shrink-0">
          {children}
          {doc.coAuthorUsernames && doc.coAuthorUsernames.length > 0 && (
            <Collaborators
              authorUsername={doc.authorUsername ?? null}
              coAuthorUsernames={doc.coAuthorUsernames}
            />
          )}
          <Button variant="secondary" size="md" onClick={() => onOpen(doc.id!)}>
            Open <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
          {isAuthor && (
            <IconButton size="sm" tone="danger" revealOnHover onClick={() => onDelete(doc.id!)} aria-label={`Delete ${doc.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </Row>
      )}
    </div>
  );
}
