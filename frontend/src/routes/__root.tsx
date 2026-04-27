import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner"
import { type QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Menu, X, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
// import { TanStackRouterDevtools } from '@tanstack/router-devtools'

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});

// ─── Liquid Glass Cursor — Green Glow ───
function CustomCursor() {
  const cursorDotRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

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
    let lastTime = performance.now();
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      // Update ambient bg glow position
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };

    const animateCursor = () => {
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);
      lastTime = now;

      // Dot follows faster
      dotX += (mouseX - dotX) * 0.35;
      dotY += (mouseY - dotY) * 0.35;

      // Glow ring follows slower — liquid trailing
      glowX += (mouseX - glowX) * 0.12;
      glowY += (mouseY - glowY) * 0.12;

      const dx = mouseX - lastMouseX;
      const dy = mouseY - lastMouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = Math.min(distance / dt, 5);

      lastMouseX = mouseX;
      lastMouseY = mouseY;

      const angle = Math.atan2(mouseY - dotY, mouseX - dotX) * (180 / Math.PI);

      // Dot: velocity-based stretching
      const dotScaleX = 1 + velocity * 0.14;
      const dotScaleY = 1 - velocity * 0.05;
      const dotBase = 1 + velocity * 0.1;

      dot.style.left = `${dotX}px`;
      dot.style.top = `${dotY}px`;

      if (distance > 1) {
        dot.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${dotBase}) scaleX(${dotScaleX}) scaleY(${dotScaleY})`;
      } else {
        dot.style.transform = `translate(-50%, -50%) scale(1)`;
      }

      // Glow ring: grows with velocity
      const glowScale = 1 + velocity * 0.35;
      const glowOpacity = 0.4 + velocity * 0.12;

      glow.style.left = `${glowX}px`;
      glow.style.top = `${glowY}px`;
      glow.style.transform = `translate(-50%, -50%) scale(${glowScale})`;
      glow.style.opacity = `${Math.min(glowOpacity, 1)}`;

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

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseover", onMouseOver);
    animateCursor();

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseover", onMouseOver);
    };
  }, []);

  return (
    <>
      <div
        ref={cursorGlowRef}
        className={`cursor-glow ${isHovering ? "hovering" : ""}`}
      />
      <div
        ref={cursorDotRef}
        className={`cursor-dot ${isHovering ? "hovering" : ""}`}
      />
    </>
  );
}

function NavBar() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isActive = (path: string) => currentPath === path;

  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {isAuthenticated && (
        <>
          <Link
            to="/dashboard"
            className={`nav-pill-link ${isActive('/dashboard') ? 'active' : ''}`}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            to="/lesson-plan"
            className={`nav-pill-link ${isActive('/lesson-plan') ? 'active' : ''}`}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
          >
            Lesson Plan
          </Link>
          <Link
            to="/mdx"
            className={`nav-pill-link ${isActive('/mdx') ? 'active' : ''}`}
            onClick={() => isMobile && setIsMobileMenuOpen(false)}
          >
            MDX Editor
          </Link>
        </>
      )}
      <Link
        to="/public-lessons"
        className={`nav-pill-link ${isActive('/public-lessons') ? 'active' : ''}`}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
      >
        Explore
      </Link>
      <Link
        to="/about"
        className={`nav-pill-link ${isActive('/about') ? 'active' : ''}`}
        onClick={() => isMobile && setIsMobileMenuOpen(false)}
      >
        About
      </Link>
    </>
  );

  const AuthSection = () => (
    <>
      {isLoading ? (
        <div className="nav-pill-link opacity-50">
          <span className="animate-pulse text-xs">...</span>
        </div>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-1">
          {user?.given_name && (
            <div className="hidden md:flex items-center gap-1.5 nav-pill-link text-white/35" style={{ fontSize: '12px' }}>
              <User className="h-3 w-3" />
              <span>{user.given_name}</span>
            </div>
          )}
          <button
            className="nav-pill-link"
            style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <a
          href="/api/login"
          className="nav-pill-link"
          style={{ color: '#22c55e', fontSize: '12px' }}
        >
          Sign in
        </a>
      )}
    </>
  );

  return (
    <>
      {/* Desktop Pill Nav */}
      <nav className="nav-pill hidden md:flex items-center gap-0.5" id="main-nav">
        <Link to="/" className="font-brand text-base gradient-text px-3 py-1 mr-1 flex-shrink-0">
          Topical
        </Link>

        <div className="w-px h-4 bg-white/8 mx-1" />

        <NavLinks isMobile={false} />

        <div className="w-px h-4 bg-white/8 mx-1" />

        <AuthSection />
      </nav>

      {/* Mobile Nav */}
      <div className="md:hidden fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        <Link to="/" className="font-brand text-lg gradient-text">
          Topical
        </Link>
        <button
          className="p-2 rounded-full text-white/60"
          style={{ background: 'rgba(10,10,10,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)' }}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden mobile-menu-overlay">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <Link
                to="/"
                className="font-brand text-lg gradient-text"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Topical
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-1 text-white/60"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2 p-6">
              <NavLinks isMobile={true} />
              <hr className="border-white/5 my-3" />
              <AuthSection />
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
      {/* Ambient background */}
      <div className="grid-bg" />
      <CustomCursor />

      {/* Pill Navbar */}
      <NavBar />

      {/* Content — push down for pill nav */}
      <main className="flex-1 px-4 py-6 w-full mx-auto relative z-10 mt-16 md:mt-20">
        <Outlet />
      </main>
      <Toaster
        toastOptions={{
          style: {
            background: 'rgba(10, 10, 10, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(34, 197, 94, 0.1)',
            color: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '14px',
          },
        }}
      />
      {/* <TanStackRouterDevtools /> */}
    </div>
  );
}
