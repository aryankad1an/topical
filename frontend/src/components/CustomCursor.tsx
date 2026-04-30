import { useEffect, useRef } from 'react';

/**
 * Futuristic custom cursor:
 * – Small sharp inner dot that snaps directly to the pointer
 * – Larger ring that follows with smooth lag
 * – Ring morphs on hover over interactive elements
 * – Perfect symmetry via translate(-50%, -50%)
 * – Acceleration and velocity-based stretch physics
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Start centered
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let raf: number;
    let isMoving = false;

    // Initialize position so it doesn't wait for mouse move
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      isMoving = true;
      // dot snaps instantly
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
    };

    const tick = () => {
      const dx = mx - rx;
      const dy = my - ry;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Dynamic lerp: moves faster when further away for an acceleration effect
      const lerpFactor = Math.min(Math.max(0.12, distance * 0.002), 0.3);
      rx += dx * lerpFactor;
      ry += dy * lerpFactor;

      // Velocity-based stretching logic
      let scaleX = 1;
      let scaleY = 1;
      let angle = 0;

      if (distance > 0.5 && isMoving) {
        angle = Math.atan2(dy, dx) * (180 / Math.PI);
        // Stretch in direction of motion, squash perpendicularly
        scaleX = Math.min(1 + distance * 0.003, 1.5);
        scaleY = Math.max(1 - distance * 0.002, 0.7);
      } else {
        // Smoothly return to circle when stopping
        isMoving = false;
      }

      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
      
      raf = requestAnimationFrame(tick);
    };

    const onEnterInteractive = () => {
      dot.classList.add('cursor-dot--hover');
      ring.classList.add('cursor-ring--hover');
    };
    const onLeaveInteractive = () => {
      dot.classList.remove('cursor-dot--hover');
      ring.classList.remove('cursor-ring--hover');
    };
    const onDown = () => {
      dot.classList.add('cursor-dot--click');
      ring.classList.add('cursor-ring--click');
    };
    const onUp = () => {
      dot.classList.remove('cursor-dot--click');
      ring.classList.remove('cursor-ring--click');
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    const interactiveSelector = 'a, button, [role="button"], input, textarea, select, label, [tabindex]';
    const attachListeners = () => {
      document.querySelectorAll<HTMLElement>(interactiveSelector).forEach(el => {
        el.addEventListener('mouseenter', onEnterInteractive);
        el.addEventListener('mouseleave', onLeaveInteractive);
      });
    };

    attachListeners();
    const observer = new MutationObserver(attachListeners);
    observer.observe(document.body, { childList: true, subtree: true });

    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}
