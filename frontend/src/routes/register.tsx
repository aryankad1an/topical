import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { KeyRound, Mail, ShieldCheck, User } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth-context';
import { passwordProblem } from '@/lib/validation';
import { AuthCard, AuthField, AuthPasswordField, AuthPitch, AuthSubmit } from '@/components/auth/AuthCard';

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
      pitch={
        <AuthPitch
          headline="Write it once. Structure it properly."
          body="Topical is a writing surface for long, structured pieces — outline first, draft in Markdown or LaTeX, publish when it holds together."
          points={[
            { icon: KeyRound, text: 'Your account lives here — no third-party sign-in required' },
            { icon: ShieldCheck, text: 'Passwords are stored as Argon2id hashes, never as text' },
            { icon: User, text: 'A public profile only exists once you publish something' },
          ]}
        />
      }
      footer={
        <>
          Already have one? <Link to="/login">Sign in</Link>
        </>
      }
      onSubmit={submit}
      error={error}
    >
      <div className="grid grid-cols-2 gap-3">
        <AuthField
          id="givenName"
          label="First name"
          placeholder="Ada"
          autoComplete="given-name"
          value={givenName}
          onChange={setGivenName}
          autoFocus
        />
        <AuthField
          id="familyName"
          label="Last name"
          placeholder="Lovelace"
          autoComplete="family-name"
          value={familyName}
          onChange={setFamilyName}
        />
      </div>
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
      />
      <AuthPasswordField
        id="password"
        label="Password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        value={password}
        onChange={setPassword}
        hint={passwordHint}
        showStrength
        required
      />
      <AuthSubmit pending={isNavigating}>Create account</AuthSubmit>
    </AuthCard>
  );
}
