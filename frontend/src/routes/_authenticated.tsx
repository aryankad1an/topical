import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { userQueryOptions } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

/**
 * The gate every signed-in screen sits behind.
 *
 * `beforeLoad` warms the user query so the child route has an answer on its
 * first render, and swallows the failure rather than throwing: an anonymous
 * visitor is an expected state here, not an error, and letting it throw would
 * replace the sign-in prompt with the router's error boundary.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context }) => {
    try {
      return await context.queryClient.fetchQuery(userQueryOptions);
    } catch {
      return { user: null };
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <VerifyingSession />;
  if (!user) return <SignInPrompt />;
  return <Outlet />;
}

function VerifyingSession() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Verifying authentication...</p>
    </div>
  );
}

/** Both links are real navigations to Kinde, not XHR — hence `<a>`, not onClick. */
function SignInPrompt() {
  const { loginUrl, registerUrl, loginAction, registerAction } = useAuth();
  return (
    <div className="flex flex-col gap-y-2 items-center justify-center min-h-[60vh]">
      <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
      <p className="text-muted-foreground mb-6">Please login or register to access this content</p>
      <div className="flex gap-4">
        <Button asChild size="lg">
          <a href={loginUrl} onClick={loginAction}>Login</a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={registerUrl} onClick={registerAction}>Register</a>
        </Button>
      </div>
    </div>
  );
}
