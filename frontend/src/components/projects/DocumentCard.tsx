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

/**
 * Line widths for the paper miniature, derived from the document's real
 * paragraph lengths so each project's thumbnail has its own silhouette.
 * Falls back to a deterministic pattern seeded from the name for empty docs,
 * so a fresh project still looks like a page rather than a blank box.
 */
function previewLines(doc: DocLike, count = 6): number[] {
  const body = docText(doc)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('```'));

  if (body.length) {
    return body.slice(0, count).map(l => Math.min(100, Math.max(28, (l.length / 72) * 100)));
  }

  let seed = 0;
  for (const ch of doc.name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: count }, (_, i) => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return 45 + ((seed >>> (i % 8)) % 50);
  });
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
  const lines = previewLines(doc);
  const words = wordCount(doc);

  return (
    <div className="doc-card group" style={docTypeVars(type)}>
      <span className="doc-badge">{isLatex ? 'LaTeX' : 'MDX'}</span>

      {/* Miniature of the document itself */}
      <div className="doc-thumb" aria-hidden="true">
        <div className="doc-thumb-title">{doc.name}</div>
        {lines.slice(0, 2).map((w, i) => (
          <div key={`a${i}`} className="doc-thumb-line" style={{ width: `${w}%` }} />
        ))}
        <div className="doc-thumb-line doc-thumb-line--h" />
        {lines.slice(2).map((w, i) => (
          <div key={`b${i}`} className="doc-thumb-line" style={{ width: `${w}%` }} />
        ))}
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
