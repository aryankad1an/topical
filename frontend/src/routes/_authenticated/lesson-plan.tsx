import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';

export const Route = createFileRoute('/_authenticated/lesson-plan')({
  component: LessonPlanRedirect,
});

/** Legacy route — redirects to the new project editor or projects hub. */
function LessonPlanRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: '/projects' } as any);
  }, [navigate]);
  return null;
}
