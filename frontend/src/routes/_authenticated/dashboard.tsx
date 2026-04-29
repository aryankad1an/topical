import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: '/projects' } as any);
  }, [navigate]);
  return null;
}