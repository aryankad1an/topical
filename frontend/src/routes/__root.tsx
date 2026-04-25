import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner"
import { type QueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Menu, X, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
// import { TanStackRouterDevtools } from '@tanstack/router-devtools'

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: Root,
});

function NavBar() {
  // Use our auth context
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle window resize - close mobile menu on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Navigation links component to avoid repetition
  const NavLinks = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Only show authenticated routes when logged in */}
      {isAuthenticated && (
        <>
          <Link to="/dashboard" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
            Dashboard
          </Link>
          <Link to="/lesson-plan" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
            Lesson Plan
          </Link>
          <Link to="/mdx" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
            MDX Editor
          </Link>
          <Link to="/public-lessons" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
            Public Lessons
          </Link>
          {/* Separator between authenticated and public routes */}
          {!isMobile && <span className="hidden md:block w-px h-5 bg-border mx-1" />}
          {isMobile && <hr className="border-border my-2" />}
        </>
      )}

      {/* Public routes - accessible to everyone */}
      <Link to="/mdxPublic" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
        MDX Public
      </Link>
      <Link to="/about" className="[&.active]:font-bold text-sm sm:text-base hover:text-primary transition-colors py-2">
        About
      </Link>
    </>
  );

  // Authentication buttons component
  const AuthButtons = () => (
    <>
      {isLoading ? (
        <Button size="sm" variant="ghost" disabled className="text-xs sm:text-sm opacity-70">
          <span className="animate-pulse">Authenticating...</span>
        </Button>
      ) : isAuthenticated ? (
        <div className="flex items-center gap-1 sm:gap-2">
          {user?.given_name && (
            <div className="hidden md:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>{user.given_name}</span>
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
          >
            Logout
          </Button>
        </div>
      ) : (
        <div className="flex gap-1 sm:gap-2">
          <Button asChild size="sm" variant="outline" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
            <a href="/api/login">Login</a>
          </Button>
          <Button asChild size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
            <a href="/api/register">Signup</a>
          </Button>
        </div>
      )}
    </>
  );

  return (
    <nav className="relative px-2 sm:px-4 py-2 sm:py-3 w-full">
      <div className="flex justify-between items-center w-full mx-auto">
        {/* Logo - always visible */}
        <Link to="/" className="text-lg sm:text-xl md:text-2xl font-bold z-10 flex-shrink-0">
          Topical
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-4 lg:gap-6">
          <NavLinks isMobile={false} />
          <div className="ml-2">
            <AuthButtons />
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden z-10 p-1 sm:p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {isMobileMenuOpen ? <X size={20} className="sm:size-24" /> : <Menu size={20} className="sm:size-24" />}
        </button>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-background z-50 md:hidden overflow-y-auto">
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-3 sm:p-4 border-b">
                <Link
                  to="/"
                  className="text-lg sm:text-2xl font-bold"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Topical
                </Link>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close menu"
                  className="p-1"
                >
                  <X size={20} className="sm:size-24" />
                </button>
              </div>
              <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 text-base sm:text-lg">
                <NavLinks isMobile={true} />
                <div className="mt-2 sm:mt-4">
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
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <hr className="w-full" />
      <main className="flex-1 px-2 sm:px-4 py-4 sm:py-6 w-full mx-auto">
        <Outlet />
      </main>
      <Toaster />
      {/* <TanStackRouterDevtools /> */}
    </div>
  );
}
