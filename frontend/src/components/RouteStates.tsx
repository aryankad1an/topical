import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { Compass, TriangleAlert } from 'lucide-react';
import { Button, EmptyState, Page, Row } from '@/components/ui';

/**
 * What the router shows for an address it does not know. It renders inside the
 * root layout, so the nav stays and there is always a way back. Before this,
 * an unknown URL printed TanStack's bare "Not Found" and nothing else.
 */
export function NotFound() {
  return (
    <Page width="narrow">
      <EmptyState
        icon={Compass}
        title="This page doesn’t exist"
        description="The link may be out of date, or the address mistyped."
        action={
          <Button asChild variant="primary" size="lg">
            <Link to="/">Go to the home page</Link>
          </Button>
        }
      />
    </Page>
  );
}

/**
 * What the router shows when a route throws while loading or rendering. It
 * says what happened and offers the two ways forward: try the same thing
 * again, or leave.
 */
export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <Page width="narrow">
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong on this page"
        description="It may be a passing problem. Try again, or go back to the home page."
        action={
          <Row gap={2} justify="center" wrap>
            <Button
              variant="primary"
              size="lg"
              onClick={() => { reset(); router.invalidate(); }}
            >
              Try again
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link to="/">Go to the home page</Link>
            </Button>
          </Row>
        }
      />
    </Page>
  );
}
