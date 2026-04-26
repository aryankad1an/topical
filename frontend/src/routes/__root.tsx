import {
  createRootRouteWithContext,
  Link,
  Outlet,
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

// ─── Liquid Glass Custom Cursor ───
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
    };

    const animateCursor = () => {
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);
      lastTime = now;

      // Dot follows faster
      dotX += (mouseX - dotX) * 0.3;
      dotY += (mouseY - dotY) * 0.3;

      // Glow ring follows slower for a trailing effect
      glowX += (mouseX - glowX) * 0.15;
      glowY += (mouseY - glowY) * 0.15;

      const dx = mouseX - lastMouseX;
      const dy = mouseY - lastMouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = Math.min(distance / dt, 5);

      lastMouseX = mouseX;
      lastMouseY = mouseY;

      const angle = Math.atan2(mouseY - dotY, mouseX - dotX) * (180 / Math.PI);

      // Dot: stretch along movement axis
      const dotScaleX = 1 + velocity * 0.12;
      const dotScaleY = 1 - velocity * 0.04;
      const dotBase = 1 + velocity * 0.08;

      dot.style.left = `${dotX}px`;
      dot.style.top = `${dotY}px`;

      if (distance > 1) {
        dot.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${dotBase}) scaleX(${dotScaleX}) scaleY(${dotScaleY})`;
      } else {
        dot.style.transform = `translate(-50%, -50%) scale(1)`;
      }

      // Glow ring: grows with velocity
      const glowScale = 1 + velocity * 0.3;
      const glowOpacity = 0.5 + velocity * 0.1;

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
      {/* Glow ring — the liquid glass trail */}
      <div
        ref={cursorGlowRef}
        className={`cursor-glow ${isHovering ? "hovering" : ""}`}
      />
      {/* Inner dot */}
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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const linkClass = "text-sm text-white/50 hover:text-white transition-colors duration-300 py-2 [&.active]:text-white";

  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {isAuthenticated && (
        <>
          <Link to="/dashboard" className={linkClass}>
            Dashboard
          </Link>
          <Link to="/lesson-plan" className={linkClass}>
            Lesson Plan
          </Link>
          <Link to="/mdx" className={linkClass}>
            MDX Editor
          </Link>
          {!isMobile && <span className="hidden md:block w-px h-4 bg-white/10 mx-1" />}
          {isMobile && <hr className="border-white/5 my-2" />}
        </>
      )}

      <Link to="/public-lessons" className={linkClass}>
        Public Lessons
      </Link>
      <Link to="/about" className={linkClass}>
        About
      </Link>
    </>
  );

  const AuthButtons = () => (
    <>
      {isLoading ? (
        <Button size="sm" variant="ghost" disabled className="text-xs opacity-70">
          <span className="animate-pulse">Authenticating...</span>
        </Button>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-3">
          {user?.given_name && (
            <div className="hidden md:flex items-center gap-2 text-xs text-white/40">
              <User className="h-3.5 w-3.5" />
              <span>{user.given_name}</span>
            </div>
          )}
          <button
            className="glass-btn text-xs h-8 px-4 flex items-center"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <a href="/api/login" className="glass-btn text-xs h-8 px-4 flex items-center">
            Login
          </a>
          <a
            href="/api/register"
            className="text-xs h-8 px-4 flex items-center rounded-xl text-white font-medium"
            style={{
              background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2))',
            }}
          >
            Signup
          </a>
        </div>
      )}
    </>
  );

  return (
    <nav className="nav-glass sticky top-0 z-50 px-4 py-3 w-full">
      <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
        <Link to="/" className="text-lg font-bold gradient-text z-10 flex-shrink-0 tracking-tight">
          Topical
        </Link>

        <div className="hidden md:flex md:items-center md:gap-6">
          <NavLinks isMobile={false} />
          <div className="ml-2">
            <AuthButtons />
          </div>
        </div>

        <button
          className="md:hidden z-10 p-2 text-white/60"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden" style={{ background: 'rgba(5, 8, 14, 0.95)', backdropFilter: 'blur(24px)' }}>
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 border-b border-white/5">
                <Link
                  to="/"
                  className="text-lg font-bold gradient-text"
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
              <div className="flex flex-col gap-4 p-6 text-base">
                <NavLinks isMobile={true} />
                <div className="mt-4">
                  <AuthButtons />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Root() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Ambient background */}
      <div className="grid-bg" />
      <CustomCursor />

      {/* Content */}
      <NavBar />
      <main className="flex-1 px-4 py-6 w-full mx-auto relative z-10">
        <Outlet />
      </main>
      <Toaster
        toastOptions={{
          style: {
            background: 'rgba(15, 20, 30, 0.8)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '12px',
          },
        }}
      />
      {/* <TanStackRouterDevtools /> */}
    </div>
  );
}
