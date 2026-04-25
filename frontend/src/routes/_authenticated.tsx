import { createFileRoute, Outlet } from "@tanstack/react-router";
import { userQueryOptions } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

const Login = () => {
  return (
    <div className="flex flex-col gap-y-2 items-center justify-center min-h-[60vh]">
      <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
      <p className="text-muted-foreground mb-6">Please login or register to access this content</p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <a href="/api/login">Login</a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href="/api/register">Register</a>
        </Button>
      </div>
    </div>
  );
};

const LoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Verifying authentication...</p>
    </div>
  );
};

const Component = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingState />;
  }

  if (!user) {
    return <Login />;
  }

  return <Outlet />;
};

// src/routes/_authenticated.tsx
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    const queryClient = context.queryClient;
    try {
      const data = await queryClient.fetchQuery(userQueryOptions);
      return data;
    } catch (e) {
      return { user: null };
    }
  },
  component: Component,
});
