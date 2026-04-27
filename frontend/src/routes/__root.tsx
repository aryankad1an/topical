import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner"
import { type QueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});

// ─── Liquid Glass Cursor (Apple-inspired) ───
function CustomCursor() {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  useEffect(() => {
    const dot = cursorDotRef.current;
    const glow = cursorGlowRef.current;
    if (!dot || !glow) return;

    let mouseX = 0;
    let mouseY = 0;
    let dotX = 0;
    let dotY = 0;
    let glowX = 0;
    let glowY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);

      // Update glass card glow tracking
      const cards = document.querySelectorAll('.glass-card');
      cards.forEach((card) => {
        const rect = (card as HTMLElement).getBoundingClientRect();
        const x = ((mouseX - rect.left) / rect.width) * 100;
        const y = ((mouseY - rect.top) / rect.height) * 100;
        (card as HTMLElement).style.setProperty('--card-mouse-x', `${x}%`);
        (card as HTMLElement).style.setProperty('--card-mouse-y', `${y}%`);
      });
    };

    const animateCursor = () => {
      // Smooth spring follow (no weird stretching or magnetic pulling)
      dotX += (mouseX - dotX) * 0.25;
      dotY += (mouseY - dotY) * 0.25;
      
      glowX += (mouseX - glowX) * 0.15;
      glowY += (mouseY - glowY) * 0.15;

      dot.style.transform = `translate3d(calc(${dotX}px - 50%), calc(${dotY}px - 50%), 0)`;
      glow.style.transform = `translate3d(calc(${glowX}px - 50%), calc(${glowY}px - 50%), 0)`;

      requestAnimationFrame(animateCursor);
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, input, textarea, select, [role="button"], label, .cursor-pointer')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const onMouseDown = () => setIsClicking(true);
    const onMouseUp = () => setIsClicking(false);

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    animateCursor();

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const hoverClass = isHovering ? "hovering" : "";
  const clickClass = isClicking ? "clicking" : "";

  return (
    <>
      <div
        ref={cursorGlowRef}
        className={`cursor-glow ${hoverClass} ${clickClass}`}
      />
      <div
        ref={cursorDotRef}
        className={`cursor-dot ${hoverClass} ${clickClass}`}
      />
    </>
  );
}

function NavBar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Position highlight over active element by default
  useEffect(() => {
    // Wait briefly for layout to settle
    const timeout = setTimeout(() => {
      const activeLink = navRef.current?.querySelector('.active');
      const highlight = highlightRef.current;
      const nav = navRef.current;
      if (activeLink && highlight && nav) {
        const linkRect = activeLink.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        highlight.style.width = `${linkRect.width}px`;
        highlight.style.height = `${linkRect.height}px`;
        highlight.style.left = `${linkRect.left - navRect.left}px`;
        highlight.style.top = `${linkRect.top - navRect.top}px`;
        highlight.style.opacity = '1';
      } else if (highlight) {
        highlight.style.opacity = '0';
      }
    }, 50);
    return () => clearTimeout(timeout);
  }, [currentPath]);

  const handleLinkHover = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const highlight = highlightRef.current;
    const nav = navRef.current;
    if (!highlight || !nav) return;

    const linkRect = e.currentTarget.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();

    highlight.style.width = `${linkRect.width}px`;
    highlight.style.height = `${linkRect.height}px`;
    highlight.style.left = `${linkRect.left - navRect.left}px`;
    highlight.style.top = `${linkRect.top - navRect.top}px`;
    highlight.style.opacity = '1';
  }, []);

  const handleNavLeave = useCallback(() => {
    const activeLink = navRef.current?.querySelector('.active');
    const highlight = highlightRef.current;
    const nav = navRef.current;
    if (activeLink && highlight && nav) {
      const linkRect = activeLink.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      highlight.style.width = `${linkRect.width}px`;
      highlight.style.height = `${linkRect.height}px`;
      highlight.style.left = `${linkRect.left - navRect.left}px`;
      highlight.style.top = `${linkRect.top - navRect.top}px`;
      highlight.style.opacity = '1';
    } else if (highlight) {
      highlight.style.opacity = '0';
    }
  }, []);

  const isActive = (path: string) => currentPath === path;

  const authLabel = isLoading ? "..." : isAuthenticated ? (user?.given_name || "Account") : "Sign in";
  const authAction = isAuthenticated ? () => { logout(); } : undefined;
  const authHref = isAuthenticated ? undefined : "/api/login";

  return (
    <>
      <nav
        ref={navRef}
        className="nav-pill hidden md:flex items-center"
        id="main-nav"
        onMouseLeave={handleNavLeave}
      >
        <div ref={highlightRef} className="nav-highlight" />

        <Link to="/" className={`nav-pill-section font-brand gradient-text ${isActive('/') ? 'active' : ''}`} onMouseEnter={handleLinkHover}>
          Topical
        </Link>
        <div className="nav-pill-divider" />
        <Link to="/public-lessons" className={`nav-pill-section ${isActive('/public-lessons') ? 'active' : ''}`} onMouseEnter={handleLinkHover}>
          Explore
        </Link>
        <div className="nav-pill-divider" />
        <Link to="/about" className={`nav-pill-section ${isActive('/about') ? 'active' : ''}`} onMouseEnter={handleLinkHover}>
          About
        </Link>
        <div className="nav-pill-divider" />
        {authHref ? (
          <a href={authHref} className="nav-pill-section nav-pill-accent" onMouseEnter={handleLinkHover}>
            {authLabel}
          </a>
        ) : (
          <button className="nav-pill-section nav-pill-accent" onMouseEnter={handleLinkHover} onClick={authAction}>
            {authLabel}
          </button>
        )}
      </nav>

      <div className="md:hidden fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        <Link to="/" className="font-brand text-lg gradient-text">Topical</Link>
        <button
          className="p-2.5 rounded-full text-white/60"
          style={{
            background: 'rgba(10,10,10,0.4)',
            backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden mobile-menu-overlay">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <Link to="/" className="font-brand text-lg gradient-text" onClick={() => setIsMobileMenuOpen(false)}>
                Topical
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" className="p-1 text-white/60">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-1 p-6">
              <Link to="/public-lessons" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Explore</Link>
              <Link to="/about" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>About</Link>
              <hr className="border-white/5 my-3" />
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
                  <Link to="/lesson-plan" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Lesson Plan</Link>
                  <hr className="border-white/5 my-3" />
                  <button className="mobile-nav-link text-left" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>Logout</button>
                </>
              ) : (
                <a href="/api/login" className="mobile-nav-link" style={{ color: '#22c55e' }}>Sign in</a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Root() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="grid-bg" />
      <CustomCursor />
      <NavBar />
      <main className="flex-1 px-4 py-6 w-full mx-auto relative z-10 mt-16 md:mt-20">
        <Outlet />
      </main>
      <Toaster
        toastOptions={{
          style: {
            background: 'rgba(10, 10, 10, 0.4)',
            backdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '14px',
          },
        }}
      />
    </div>
  );
}
