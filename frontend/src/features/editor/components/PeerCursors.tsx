/**
 * PeerCursors — pixel-perfect cursor positioning using a mirror div
 * with native text nodes (not innerHTML) for exact textarea match.
 * Name label shows on hover.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { AwarenessCursor } from '@/hooks/useYjsCollab';

interface Props {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  content: string;
  peers: AwarenessCursor[];
}

interface CursorPos {
  clientId: number;
  name: string;
  color: string;
  x: number;
  y: number;
  lineH: number;
  /** One box per visual line of the peer's selection, if they have one. */
  rects: { x: number; y: number; w: number; h: number }[];
}

// Styles to copy from textarea to mirror div for pixel-perfect match
const MIRROR_PROPS = [
  'direction', 'boxSizing', 'width',
  'overflowX', 'overflowY',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
  'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent',
  'textTransform', 'textRendering',
  'whiteSpace', 'wordWrap', 'overflowWrap', 'wordBreak',
  'tabSize', 'hyphens',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
];

export function PeerCursors({ textareaRef, content, peers }: Props) {
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<CursorPos[]>([]);

  // Create mirror div once, appended to document body
  useEffect(() => {
    const div = document.createElement('div');
    div.setAttribute('aria-hidden', 'true');
    Object.assign(div.style, {
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      visibility: 'hidden',
      pointerEvents: 'none',
      // pre-wrap matches textarea behavior for whitespace/newlines
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    });
    document.body.appendChild(div);
    mirrorRef.current = div;
    return () => {
      document.body.removeChild(div);
      mirrorRef.current = null;
    };
  }, []);

  const compute = useCallback(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror || peers.length === 0) {
      setPositions([]);
      return;
    }

    // Copy ALL relevant styles from textarea to mirror
    const cs = getComputedStyle(ta);
    for (const prop of MIRROR_PROPS) {
      const kebab = prop.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
      mirror.style.setProperty(kebab, cs.getPropertyValue(kebab));
    }

    // Critical: match the textarea's content width exactly.
    // If textarea has a scrollbar, clientWidth excludes it.
    // We set the mirror's box-sizing to match and use the computed width.
    // But then we need the actual inner width for wrapping accuracy.
    // Using clientWidth + border-box ensures the content area is identical.
    mirror.style.boxSizing = 'border-box';
    mirror.style.width = ta.offsetWidth + 'px';

    const lineH = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.7);
    const scrollTop = ta.scrollTop;
    const visH = ta.clientHeight;

    const results: CursorPos[] = [];

    for (const peer of peers) {
      // Only show cursor for peers that have explicitly set one
      if (!peer.cursor || peer.cursor.index == null || peer.cursor.index < 0) continue;
      const idx = Math.min(peer.cursor.index, content.length);
      const len = Math.max(0, Math.min(peer.cursor.length ?? 0, content.length - idx));

      // Build mirror content using real text nodes for accurate rendering
      // This ensures whitespace, tabs, newlines render identically to textarea
      mirror.textContent = '';

      const textBefore = content.substring(0, idx);
      const textAfter = content.substring(idx);

      // Text before cursor
      const beforeNode = document.createTextNode(textBefore);
      mirror.appendChild(beforeNode);

      // Zero-width marker span at cursor position
      const marker = document.createElement('span');
      marker.style.display = 'inline';
      marker.style.width = '0';
      marker.style.overflow = 'hidden';
      marker.textContent = '\u200B'; // zero-width space — gives the span measurable height
      mirror.appendChild(marker);

      // Text after cursor (needed for accurate wrapping context)
      const afterNode = document.createTextNode(textAfter);
      mirror.appendChild(afterNode);

      // Measure
      const mirrorRect = mirror.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();

      // Offsets are relative to the surface the cursors are drawn in, so a
      // textarea that isn't flush against it (a gutter, a border) still lines up.
      const x = markerRect.left - mirrorRect.left + ta.offsetLeft;
      const y = markerRect.top - mirrorRect.top - scrollTop + ta.offsetTop;

      /* ── The peer's selection ──
         Awareness has carried `length` since the beginning; only the caret was
         ever drawn from it, so a collaborator highlighting a paragraph showed
         up as a single blinking bar and you could not see what they were about
         to change. A DOM Range over the mirror gives one rect per *visual*
         line, which is what a wrapped selection actually is — a single box
         from start to end would paint straight through the right-hand gutter
         on every line but the last. */
      const rects: CursorPos['rects'] = [];
      if (len > 0) {
        const range = document.createRange();
        // The marker splits the text: everything before it is `beforeNode`,
        // everything after is `afterNode`, so the selection starts at the
        // marker and runs `len` characters into what follows.
        range.setStart(marker, 0);
        range.setEnd(afterNode, Math.min(len, afterNode.length));
        for (const r of Array.from(range.getClientRects())) {
          if (r.width < 0.5) continue;
          rects.push({
            x: r.left - mirrorRect.left + ta.offsetLeft,
            y: r.top - mirrorRect.top - scrollTop + ta.offsetTop,
            w: r.width,
            h: r.height,
          });
        }
        range.detach?.();
      }

      const onScreen = (v: number) => v >= -lineH && v <= visH + lineH;
      if (onScreen(y) || rects.some(r => onScreen(r.y))) {
        results.push({
          clientId: peer.clientId,
          name: peer.user.name,
          color: peer.user.color,
          x: Math.max(0, x),
          y,
          lineH,
          rects: rects.filter(r => onScreen(r.y)),
        });
      }
    }

    setPositions(results);
  }, [content, peers, textareaRef]);

  // Recompute on content/peers change
  useEffect(() => { compute(); }, [compute]);

  // Recompute on scroll
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('scroll', compute, { passive: true });
    return () => ta.removeEventListener('scroll', compute);
  }, [textareaRef, compute]);

  // Recompute on resize
  useEffect(() => {
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [compute]);

  if (positions.length === 0) return null;

  return (
    <>
      {/* Selections first, so a caret is never painted under a highlight. */}
      {positions.flatMap(pos =>
        pos.rects.map((r, i) => (
          <div
            key={`${pos.clientId}-sel-${i}`}
            className="peer-selection"
            aria-hidden="true"
            style={{
              left: r.x,
              top: r.y,
              width: r.w,
              height: r.h,
              /* The peer's own colour, well under the document's own selection
                 so the two are distinguishable when they overlap. */
              background: `${pos.color}2e`,
              borderTop: `1px solid ${pos.color}55`,
              borderBottom: `1px solid ${pos.color}55`,
            }}
          />
        )),
      )}

      {positions.map(pos => (
        <div
          key={pos.clientId}
          className="peer-cursor-wrapper"
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            zIndex: 20,
            transition: 'left 0.12s ease-out, top 0.12s ease-out',
          }}
        >
          {/* Hoverable hit area */}
          <div style={{ position: 'relative', width: '10px', height: `${pos.lineH}px`, cursor: 'default', pointerEvents: 'auto' }}>
            {/* Cursor line — always visible */}
            <div style={{
              position: 'absolute', left: 0, top: 0,
              width: '2px', height: '100%',
              background: pos.color, borderRadius: '1px',
              boxShadow: `0 0 4px ${pos.color}50`,
            }} />
            {/* Dot at top for easy spotting */}
            <div style={{
              position: 'absolute', left: '-1.5px', top: '-2px',
              width: '5px', height: '5px', borderRadius: '50%',
              background: pos.color,
            }} />
            {/* Name label — hidden, shown on hover via CSS */}
            <div className="peer-cursor-label" style={{
              position: 'absolute', top: '-2px', left: '8px',
              background: pos.color, color: 'var(--ink)',
              fontSize: '10px', fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              padding: '2px 7px', borderRadius: '0 4px 4px 4px',
              whiteSpace: 'nowrap', lineHeight: '14px',
              opacity: 0, transform: 'scale(0.9) translateX(-2px)',
              transition: 'opacity 0.15s ease, transform 0.15s ease',
              pointerEvents: 'none',
              boxShadow: `0 2px 8px ${pos.color}30`,
            }}>
              {pos.name}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
