import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner"
import { CustomCursor } from "@/components/CustomCursor";
import { OnboardingModal } from "@/components/OnboardingModal";
import { type QueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Home, FolderOpen, Users, UserRound, Command } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CommandPalette } from "@/components/CommandPalette";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});

function NavBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { isAuthenticated, loginUrl, loginAction, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isActive = (path: string) => currentPath === path;

  // Home lives on the brand mark and Profile lives on the avatar, so neither
  // gets a second text link in the pill.
  const links = isAuthenticated
    ? [
        { to: '/', label: 'Home', icon: Home },
        { to: '/projects', label: 'Projects', icon: FolderOpen },
        { to: '/community', label: 'Community', icon: Users },
        { to: '/profile', label: 'Profile', icon: UserRound },
      ]
    : [
        { to: '/', label: 'Home', icon: Home },
        { to: '/community', label: 'Community', icon: Users },
      ];

  const navLinks = links.filter(l => l.to !== '/' && l.to !== '/profile');

  // The active pill is one element that slides, rather than a background on
  // each link — so switching pages reads as movement instead of a jump cut.
  const shellRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const shell = shellRef.current;
      if (!shell) return;
      const active = shell.querySelector<HTMLElement>("[data-active='true']");
      if (!active) { setIndicator(null); return; }
      const a = active.getBoundingClientRect();
      const s = shell.getBoundingClientRect();
      setIndicator({ x: a.left - s.left, w: a.width });
    };
    measure();
    window.addEventListener('resize', measure);
    // Fonts land after first paint and change link widths.
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [currentPath, isAuthenticated, navLinks.length]);

  const initial = (user?.given_name?.[0] || user?.username?.[0] || 'U').toUpperCase();
  // The same picture the profile page shows: an upload wins, then whatever the
  // identity provider gave us, and only then the letter.
  const avatarSrc = user?.avatarUrl || user?.picture || null;

  return (
    <>
      {/* Desktop nav */}
      <nav
        id="main-nav"
        className="hidden md:flex fixed z-[100]"
        style={{
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(8, 8, 8, 0.55)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 100,
          padding: '6px 8px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)',
        }}
      >
        {/* Logo / brand */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px 8px 12px',
            borderRadius: 100,
            marginRight: 4,
            background: isActive('/') ? 'rgba(148,163,184,0.10)' : 'transparent',
            transition: 'background 0.25s',
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'linear-gradient(135deg,#94a3b8,#e2e8f0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(148,163,184,0.35)',
            flexShrink: 0,
          }}>
            <span style={{ color: '#000', fontWeight: 800, fontSize: 13, fontFamily: 'inherit' }}>T</span>
          </div>
          <span
            className="font-brand"
            style={{
              fontSize: 15,
              fontWeight: 700,
              background: 'linear-gradient(135deg, #94a3b8, #e2e8f0)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Topical
          </span>
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} />

        <div className="nav-shell" ref={shellRef}>
          <span
            className="nav-indicator"
            style={{
              width: indicator?.w ?? 0,
              transform: `translate(${indicator?.x ?? 0}px, -50%)`,
              opacity: indicator ? 1 : 0,
            }}
          />
          {navLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className="nav-link" data-active={isActive(to)}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', margin: '0 6px', flexShrink: 0 }} />

        <button className="nav-kbd" onClick={onOpenCommand} title="Command palette" aria-label="Open command palette">
          <Command className="h-3 w-3" />K
        </button>

        {isAuthenticated ? (
          <Link to="/profile" style={{ marginLeft: 8, textDecoration: 'none' }} title="Profile" aria-label="Profile">
            <span className="nav-avatar">
              {avatarSrc ? <img src={avatarSrc} alt="" /> : initial}
            </span>
          </Link>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
            <a
              href={loginUrl}
              onClick={loginAction}
              className="accent-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '7px 16px',
                borderRadius: 100,
                fontSize: 13,
                textDecoration: 'none',
                cursor: 'pointer',
                minHeight: 0,
              }}
            >
              Sign in
            </a>
          </div>
        )}
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          background: 'rgba(8,8,8,0.7)',
          backdropFilter: 'blur(40px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
        <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: 'linear-gradient(135deg,#94a3b8,#e2e8f0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#000', fontWeight: 800, fontSize: 12 }}>T</span>
          </div>
          <span className="font-brand text-base" style={{
            background: 'linear-gradient(135deg,#94a3b8,#e2e8f0)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Topical</span>
        </Link>
        <button
          className="p-2 rounded-full text-white/60"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[200] md:hidden mobile-menu-overlay">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-center p-5 border-b border-white/5">
              <Link to="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)} style={{ textDecoration: 'none' }}>
                <div style={{ width: 24, height: 24, borderRadius: 7, background: 'linear-gradient(135deg,#94a3b8,#e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#000', fontWeight: 800, fontSize: 12 }}>T</span>
                </div>
                <span className="font-brand text-lg" style={{ background: 'linear-gradient(135deg,#94a3b8,#e2e8f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Topical</span>
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu" className="p-1 text-white/60"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-1 p-6">
              {links.map(link => (
                <Link key={link.to} to={link.to} className="mobile-nav-link" onClick={() => setIsMobileMenuOpen(false)}>{link.label}</Link>
              ))}
              {!isAuthenticated && (
                <a
                  href={loginUrl}
                  className="mobile-nav-link"
                  onClick={(e) => { setIsMobileMenuOpen(false); loginAction(e); }}
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


function Root() {
  const { isLoading, isAuthenticated } = useAuth();
  const searchParams = new URL(window.location.href).searchParams;
  const isAuthCallback = searchParams.get('auth_success') === '1';

  // All hooks must run unconditionally on every render (Rules of Hooks) — in
  // particular, before the early return below, which only some renders take.
  const routerState = useRouterState();
  const isEditorRoute = routerState.location.pathname.startsWith('/editor');
  const [commandOpen, setCommandOpen] = useState(false);

  // ⌘K / Ctrl-K anywhere, including the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  return (
    <div className="min-h-screen flex flex-col relative">
      <CustomCursor />
      {!isEditorRoute && <div className="grid-bg" />}
      {!isEditorRoute && <NavBar onOpenCommand={() => setCommandOpen(true)} />}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        isAuthenticated={isAuthenticated}
      />
      <OnboardingModal />
      <main className={`flex-1 w-full mx-auto relative z-10 ${isEditorRoute ? '' : 'px-4 py-6 mt-20 md:mt-24'}`}>
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
