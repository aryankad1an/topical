import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Reveals its children once, when they first reach the viewport.
 *
 * The purpose is the one the framework allows for scroll motion: a section
 * that is already fully painted before it is looked at reads as static
 * furniture, and one that snaps in at the moment of arrival reads as broken.
 * A short rise into place is the difference.
 *
 * It observes once and disconnects — an element that re-animates every time
 * it passes the fold turns a scroll into a slideshow. `data-shown` is set on
 * a wrapper rather than each child so a group can stagger from one flag.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Anything already on screen at mount should simply be there; the entrance
    // is for things scrolled to, not for the first paint.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-shown={shown}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
