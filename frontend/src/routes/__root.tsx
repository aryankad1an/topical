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
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  
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
  }, [currentPath, isAuthenticated, updateNavItemWidth]);

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

        <Link to="/projects" className={`nav-pill-section ${isActive('/projects') ? 'active' : ''}`}>
          Projects
        </Link>
        <div className="nav-pill-divider" />

        <Link to="/community" className={`nav-pill-section ${isActive('/community') ? 'active' : ''}`}>
          Community
        </Link>
        <div className="nav-pill-divider" />

        <Link to="/profile" className={`nav-pill-section nav-pill-accent ${isActive('/profile') ? 'active' : ''}`}>
          Profile
        </Link>
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
              <Link to="/projects" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Projects</Link>
              <Link to="/community" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Community</Link>
              <Link to="/profile" className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>Profile</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Root() {
  const { isLoading } = useAuth();
  const searchParams = new URL(window.location.href).searchParams;
  const isAuthCallback = searchParams.get('auth_success') === '1';

  useEffect(() => {
    if (isAuthCallback && !isLoading) {
      // Remove auth_success from URL without reloading the page
      const url = new URL(window.location.href);
      url.searchParams.delete('auth_success');
      window.history.replaceState({}, '', url);
    }
  }, [isAuthCallback, isLoading]);

  // If returning from Kinde, show a loading screen while resolving cache
  if (isAuthCallback && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="grid-bg" />
        <div className="z-10 flex flex-col items-center gap-4 text-white">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="opacity-70 text-sm">Completing authentication...</p>
        </div>
      </div>
    );
  }

  const isEditorRoute = window.location.pathname.startsWith('/editor');

  return (
    <div className="min-h-screen flex flex-col relative">
      {!isEditorRoute && <div className="grid-bg" />}
      {!isEditorRoute && <NavBar />}
      <main className={`flex-1 w-full mx-auto relative z-10 ${isEditorRoute ? '' : 'px-4 py-6 mt-16 md:mt-20'}`}>
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
