import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { userQueryOptions } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button, LoadingState, Text, Row, Stack } from '@/components/ui';

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
    <LoadingState size="page" label="Verifying authentication..." />
  );
}

/**
 * Both screens are routes in this application, so these are client-side
 * `Link`s — the sign-in form renders without a round trip, and the page the
 * visitor was blocked from is carried along so they land back on it.
 */
function SignInPrompt() {
  const { pathname } = useLocation();
  return (
    <Stack gapY={2} align="center" justify="center" className="min-h-[60dvh]">
      <Text as="h2" size="2xl" weight="bold" className="mb-4">Authentication Required</Text>
      <Text tone="muted" className="mb-6">Please sign in or create an account to access this content</Text>
      <Row gap={4}>
        <Button asChild variant="primary" size="xl">
          <Link to="/login" search={{ redirect: pathname }}>Sign in</Link>
        </Button>
        <Button asChild variant="secondary" size="xl">
          <Link to="/register">Create account</Link>
        </Button>
      </Row>
    </Stack>
  );
}
