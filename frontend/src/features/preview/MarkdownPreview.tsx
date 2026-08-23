import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';

interface Props {
  content: string;
  /**
   * Tag every block with the source line it came from, so the editor can keep
   * both panes in step and jump from the preview back into the text.
   */
  trackSource?: boolean;
}

/** hast nodes carry their source position; blocks use it for scroll sync. */
type HastNode = { position?: { start?: { line?: number } }; children?: HastNode[]; value?: string };

function lineAttrs(node: HastNode | undefined, track: boolean | undefined) {
  const line = node?.position?.start?.line;
  return track && line ? { 'data-line': line } : {};
}

/** Flatten a hast subtree to text — for heading slugs and copy buttons. */
function textOf(node: HastNode | undefined): string {
  if (!node) return '';
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
}

const CALLOUTS: Record<string, { label: string; kind: string }> = {
  NOTE: { label: 'Note', kind: 'note' },
  TIP: { label: 'Tip', kind: 'tip' },
  IMPORTANT: { label: 'Important', kind: 'important' },
  WARNING: { label: 'Warning', kind: 'warning' },
  CAUTION: { label: 'Caution', kind: 'caution' },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="md-copy"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label="Copy code"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Markdown/MDX rendering used by the editor, the reader and the community
 * pages, so a document looks the same everywhere it appears.
 */
export function MarkdownPreview({ content, trackSource }: Props) {
  const heading = (level: number) =>
    function Heading({ node, children }: { node?: HastNode; children?: ReactNode }) {
      const Tag = `h${level}` as 'h1';
      const id = slugify(textOf(node));
      return (
        <Tag id={id} className="md-h" {...lineAttrs(node, trackSource)}>
          {children}
          {/* A quiet anchor: visible on hover, so long documents are linkable. */}
          {id && <a href={`#${id}`} className="md-anchor" aria-label="Link to this section">#</a>}
        </Tag>
      );
    };

  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          h1: heading(1), h2: heading(2), h3: heading(3),
          h4: heading(4), h5: heading(5), h6: heading(6),

          p: ({ node, children }) => <p {...lineAttrs(node as HastNode, trackSource)}>{children}</p>,
          ul: ({ node, children }) => <ul {...lineAttrs(node as HastNode, trackSource)}>{children}</ul>,
          ol: ({ node, children }) => <ol {...lineAttrs(node as HastNode, trackSource)}>{children}</ol>,
          hr: ({ node }) => <hr {...lineAttrs(node as HastNode, trackSource)} />,

          blockquote: ({ node, children }) => {
            // GitHub-style callouts: `> [!NOTE]` on the first line.
            const marker = /^\[!(\w+)\]/.exec(textOf(node as HastNode).trim());
            const callout = marker && CALLOUTS[marker[1].toUpperCase()];
            if (!callout) {
              return <blockquote {...lineAttrs(node as HastNode, trackSource)}>{children}</blockquote>;
            }
            return (
              <div className="md-callout" data-kind={callout.kind} {...lineAttrs(node as HastNode, trackSource)}>
                <div className="md-callout-title">{callout.label}</div>
                <div className="md-callout-body">{children}</div>
              </div>
            );
          },

          pre: ({ node, children }) => {
            const code = (node as HastNode)?.children?.[0];
            const language = /language-(\w+)/.exec(
              String(((code as unknown as { properties?: { className?: string[] } })?.properties?.className ?? []).join(' ')),
            )?.[1];
            return (
              <div className="md-code" {...lineAttrs(node as HastNode, trackSource)}>
                <div className="md-code-bar">
                  <span className="md-code-lang">{language ?? 'text'}</span>
                  <CopyButton text={textOf(code)} />
                </div>
                <pre>{children}</pre>
              </div>
            );
          },

          table: ({ node, children }) => (
            <div className="md-table-wrap" {...lineAttrs(node as HastNode, trackSource)}>
              <table>{children}</table>
            </div>
          ),

          img: ({ node, ...props }) => <img className="md-img" loading="lazy" {...props} />,

          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith('#') ? undefined : '_blank'}
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
