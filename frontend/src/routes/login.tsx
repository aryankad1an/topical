import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { Mail, PenLine, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth-context';
import { AuthCard, AuthField, AuthPasswordField, AuthPitch, AuthSubmit } from '@/components/auth/AuthCard';

/**
 * Sign in.
 *
 * `redirect` is where the visitor was heading before the gate stopped them,
 * so they land back on it rather than on the home page.
 */
export const Route = createFileRoute('/login')({
  // The property is optional, not "required and possibly undefined" — the
  // difference is whether every `<Link to="/login">` has to pass a search object.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: LoginPage,
});

function LoginPage() {
  const { login, isNavigating } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: '/login' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await login({ email: email.trim(), password });
      toast.success('Signed in');
      // `replace` so the back button does not return to a sign-in form the
      // visitor has already passed through.
      navigate({ to: redirect || '/projects', replace: true });
    } catch (err) {
      // The server sends one sentence for both halves of a failed sign-in, so
      // this is shown as-is rather than guessed at.
      setError(err instanceof Error ? err.message : 'Could not sign in');
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to reach your documents."
      pitch={
        <AuthPitch
          headline="Pick up where you left off."
          body="Your outlines, drafts and published pieces are exactly as you left them."
          points={[
            { icon: PenLine, text: 'Markdown and LaTeX in one editor, with a live preview' },
            { icon: Sparkles, text: 'An outline rail that drafts and refines structure with you' },
            { icon: Share2, text: 'Publish to the community when a piece is ready — not before' },
          ]}
        />
      }
      footer={
        <>
          No account yet? <Link to="/register">Create one</Link>
        </>
      }
      onSubmit={submit}
      error={error}
    >
      <AuthField
        id="email"
        label="Email"
        type="email"
        icon={Mail}
        placeholder="you@example.com"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
        autoFocus
      />
      <AuthPasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={setPassword}
        required
      />
      <AuthSubmit pending={isNavigating}>Sign in</AuthSubmit>
    </AuthCard>
  );
}
