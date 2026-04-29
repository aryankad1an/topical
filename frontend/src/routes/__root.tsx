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

function NavBar() {
  const { user, isAuthenticated, loginUrl, logout, loginAction, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  
  const authLabel = isLoading 
    ? <span className="opacity-0">Loading</span>
    : isAuthenticated ? (user?.given_name || "Account") : "Sign in";

  const authAction = isAuthenticated ? () => { logout(); } : undefined;
  const authHref = isAuthenticated ? undefined : loginUrl;

  const updateNavItemWidth = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const items = Array.from(nav.querySelectorAll<HTMLElement>(".nav-pill-section"));
    if (items.length === 0) return;
    const maxWidth = Math.max(...items.map((item) => item.scrollWidth));
    nav.style.setProperty("--nav-pill-item-width", `${Math.ceil(maxWidth)}px`);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
      updateNavItemWidth();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateNavItemWidth]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => updateNavItemWidth());
    return () => cancelAnimationFrame(raf);
  }, [currentPath, isAuthenticated, authLabel, updateNavItemWidth]);

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

  const isActive = (path: string) => currentPath === path;

  return (
    <>
      <nav
        ref={navRef}
        className="nav-pill hidden md:flex items-center"
        id="main-nav"
      >
        <div ref={highlightRef} className="nav-highlight" />

        <Link to="/" className={`nav-pill-section font-brand gradient-text ${isActive('/') ? 'active' : ''}`}>
          Topical
        </Link>
        <div className="nav-pill-divider" />

        {isAuthenticated && (
          <>
            <Link to="/dashboard" className={`nav-pill-section ${isActive('/dashboard') ? 'active' : ''}`}>
              Dashboard
            </Link>
            <div className="nav-pill-divider" />
            <Link to="/lesson-plan" className={`nav-pill-section ${isActive('/lesson-plan') ? 'active' : ''}`}>
              Lesson Plan
            </Link>
            <div className="nav-pill-divider" />
            <Link to="/profile" className={`nav-pill-section ${isActive('/profile') ? 'active' : ''}`}>
              Profile
            </Link>
            <div className="nav-pill-divider" />
          </>
        )}

        <Link to="/public-lessons" className={`nav-pill-section ${isActive('/public-lessons') ? 'active' : ''}`}>
          Explore
        </Link>
        <div className="nav-pill-divider" />
        <Link to="/about" className={`nav-pill-section ${isActive('/about') ? 'active' : ''}`}>
          About
        </Link>
        <div className="nav-pill-divider" />

        {isAuthenticated ? (
          <button className="nav-pill-section nav-pill-accent" onClick={authAction}>
            Sign out
          </button>
        ) : (
          <a href={authHref} onClick={loginAction} className="nav-pill-section nav-pill-accent">
            {authLabel}
          </a>
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
                  <Link to="/profile" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Profile</Link>
                  <hr className="border-white/5 my-3" />
                  <button className="mobile-nav-link text-left" onClick={() => { logout(); setIsMobileMenuOpen(false); }}>Sign out</button>
                </>
              ) : isLoading ? (
                <span className="mobile-nav-link text-white/20">Sign in</span>
              ) : (
                <a href={loginUrl} onClick={loginAction} className="mobile-nav-link" style={{ color: '#22c55e' }}>Sign in</a>
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
