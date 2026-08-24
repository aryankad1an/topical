import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth-context';
import { passwordProblem } from '@/lib/validation';
import { AuthCard, AuthField, AuthSubmit } from '@/components/auth/AuthCard';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { register, isNavigating } = useAuth();
  const navigate = useNavigate();

  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The same rule the server enforces, shown while the reader is still typing
  // rather than after a round trip.
  const passwordHint = password ? passwordProblem(password) : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }

    try {
      await register({
        email: email.trim(),
        password,
        given_name: givenName.trim() || undefined,
        family_name: familyName.trim() || undefined,
      });
      toast.success('Account created');
      navigate({ to: '/projects', replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that account');
    }
  };

  return (
    <AuthCard
      title="Create an account"
      subtitle="Everything you write stays yours until you publish it."
      footer={
        <>
          Already have one?{' '}
          <Link to="/login" className="text-[var(--accent-500)] font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
      onSubmit={submit}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <AuthField
          id="givenName"
          label="First name"
          autoComplete="given-name"
          value={givenName}
          onChange={setGivenName}
          autoFocus
        />
        <AuthField
          id="familyName"
          label="Last name"
          autoComplete="family-name"
          value={familyName}
          onChange={setFamilyName}
        />
      </div>
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        required
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        hint={passwordHint}
        required
      />
      <AuthSubmit pending={isNavigating}>
        {isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
      </AuthSubmit>
    </AuthCard>
  );
}
