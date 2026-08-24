import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { changePassword } from '@/lib/api';
import { passwordProblem } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
        <form onSubmit={submit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              {error}
            </p>
          )}

          <Button type="submit" variant="outline" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
