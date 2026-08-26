import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { Users, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/primitives';

interface Props {
  /** The owner's handle. Null for your own document, which has no byline yet. */
  authorUsername: string | null;
  /** Positional; null for a collaborator who has not set a handle. */
  coAuthorUsernames: (string | null)[];
  /** Offered inside the list, to whoever is allowed to change it. */
  onManage?: () => void;
  className?: string;
}

/** Where the panel sits, in viewport coordinates. */
interface Placement {
  top: number;
  left: number;
  /** Which corner it grows from, so the animation starts where the panel is. */
  origin: string;
}

const PANEL_WIDTH = 216;
const GAP = 7;
const MARGIN = 8;

/**
 * Who is on a document — as a count you can open, not a number you can only
 * hover.
 *
 * Every surface that mentioned collaborators showed the same bare figure: a
 * people icon and "3". The projects card had no way at all to say who those
 * three were; the reader dialog put the names in a `title`, which is a
 * tooltip — it needs a mouse, it needs a second of hovering, and it cannot be
 * clicked through to the person. The names are the useful part, so they belong
 * behind a click, with each one leading to the profile it names.
 *
 * The panel is portalled to the body rather than positioned inside the trigger.
 * Two of the four places this appears clip it otherwise: `.doc-card` sets
 * `overflow: hidden` so its thumbnail can have rounded corners, and the editor
 * header is a fixed bar. An absolutely-positioned panel is cropped by the
 * nearest clipping ancestor no matter what its z-index says.
 */
export function Collaborators({ authorUsername, coAuthorUsernames, onManage, className }: Props) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const people = [
    { username: authorUsername, role: 'Owner' as const },
    ...coAuthorUsernames.map(username => ({ username, role: 'Collaborator' as const })),
  ];

  /**
   * Put the panel under its trigger, and keep it on screen.
   *
   * Measured rather than assumed: these chips appear at the left of a card, at
   * the right of a list row, and in a bar at the top of the page, so a single
   * fixed offset is wrong in at least two of them.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;

    // Below by default; above when the panel would otherwise run off the foot
    // of the window and there is more room the other way.
    const below = box.bottom + GAP;
    const flip = height > 0 && below + height > window.innerHeight - MARGIN && box.top > height + GAP;
    const top = flip ? box.top - GAP - height : below;

    const left = Math.min(
      Math.max(MARGIN, box.left),
      Math.max(MARGIN, window.innerWidth - PANEL_WIDTH - MARGIN),
    );

    setPlacement({ top, left, origin: flip ? 'bottom left' : 'top left' });
  }, []);

  // Before paint, so the panel never shows at the wrong coordinates first.
  useLayoutEffect(() => {
    if (!open) { setPlacement(null); return; }
    place();
  }, [open, place]);

  // A second pass once the panel has a height, which is what decides the flip.
  useLayoutEffect(() => {
    if (open && placement && panelRef.current) place();
    // Running on `open` alone is the point: re-running on `placement` would
    // loop, and the height is settled by the time this fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    // A portalled panel does not travel with the page, so it has to be told.
    // `capture` catches scrolling in any pane, not just the window.
    const onScroll = () => place();

    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [close, open, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`people-chip${className ? ` ${className}` : ''}`}
        data-open={open || undefined}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`${people.length} ${people.length === 1 ? 'person' : 'people'} on this document`}
      >
        <Users className="h-3 w-3" />
        {people.length}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          className="people-pop"
          role="menu"
          style={{
            top: placement?.top ?? -9999,
            left: placement?.left ?? -9999,
            transformOrigin: placement?.origin ?? 'top left',
            // Hidden until measured, so it cannot flash at the wrong place.
            visibility: placement ? 'visible' : 'hidden',
          }}
        >
          <p className="people-pop-title">
            {people.length === 1 ? '1 person' : `${people.length} people`} on this document
          </p>
          <ul className="people-list">
            {people.map(({ username, role }, i) => {
              /* Not everyone has a handle — a person who has not set one
                 resolves to null. They still have to appear (the count above
                 is of people, and a list shorter than its own heading is worse
                 than an unnamed row) but cannot be a link, because there is no
                 profile at the other end.

                 "Member", not "You": a missing handle says nothing about who is
                 looking. The role beside the row carries the distinction that
                 actually matters. */
              const label = username ? `@${username}` : 'Member';
              const inner = (
                <>
                  <Avatar seed={username ?? `co-${i}`} name={label} size="sm" />
                  <span className="people-name">{label}</span>
                  <span className="people-role">{role}</span>
                </>
              );
              return (
                <li key={username ?? `unnamed-${i}`}>
                  {username ? (
                    <Link to="/u/$username" params={{ username }} className="people-row" onClick={close}>
                      {inner}
                    </Link>
                  ) : (
                    <span className="people-row people-row--plain">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {onManage && (
            <button
              type="button"
              className="people-manage"
              onClick={() => { close(); onManage(); }}
            >
              <UserPlus className="h-3.5 w-3.5" /> Manage collaborators
            </button>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
