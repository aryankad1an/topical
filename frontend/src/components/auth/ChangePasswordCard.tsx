import { useState } from 'react';
import { toast } from 'sonner';

import { changePassword } from '@/lib/api';
import { passwordProblem } from '@/lib/validation';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Notice, Stack } from '@/components/ui';

/**
 * Change your password.
 *
 * The account lives in this application now, so this is a form rather than a
 * link out to somebody else's settings screen. Succeeding here signs every
 * *other* browser out — which is the point of changing a password — while
 * leaving this one signed in.
 */
export function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(next);
    if (problem) {
      setError(problem);
      return;
    }

    setPending(true);
    try {
      await changePassword({ current_password: current, new_password: next });
      setCurrent('');
      setNext('');
      toast.success('Password changed. Other sessions have been signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>
          Changing it signs out every other browser you are signed in on.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack as="form" gap={4} onSubmit={submit}>
          <Field id="current-password" label="Current password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </Field>
          <Field id="new-password" label="New password">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>

          {error && (
            <Notice variant="inline">{error}</Notice>
          )}

          <Button type="submit" variant="secondary" size="lg" width="full" loading={pending}>
            {!pending && 'Change password'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
