import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route: any = createFileRoute('/_authenticated/')({
  beforeLoad: () => {
    // Redirect to the dashboard
    return redirect({
      to: '/dashboard',
    });
  },
  component: Index,
});

function Index() {
  // This component won't be rendered due to the redirect
  return null;
}
