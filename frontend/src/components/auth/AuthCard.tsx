import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Surface } from '@/components/ui/primitives';

/**
 * The frame both sign-in screens sit in.
 *
 * Written once because the two forms differ only in their fields: a second
 * copy is how the sign-in and sign-up screens end up with different spacing,
 * different error placement, and the same bug fixed on only one of them.
 */
export function AuthCard({
  title,
  subtitle,
  footer,
  error,
  onSubmit,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  /** The server's own sentence, shown verbatim above the submit button. */
  error?: string | null;
  onSubmit: (event: React.FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-center min-h-[80vh] w-full"
      style={{ paddingInline: 'var(--gutter)' }}
    >
      <Surface size="lg" className="w-full max-w-sm">
        <h1 className="font-brand text-2xl tracking-tight text-[var(--ink)]">{title}</h1>
        {subtitle && (
          <p className="mt-2 text-sm text-[var(--ink-faint)] leading-relaxed">{subtitle}</p>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {children}

          {error && (
            <p role="alert" className="text-sm text-[var(--status-danger)]">
              {error}
            </p>
          )}
        </form>

        {footer && <p className="mt-6 text-sm text-[var(--ink-faint)]">{footer}</p>}
      </Surface>
    </div>
  );
}

/** One labelled field, with an optional inline rule below it. */
export function AuthField({
  id,
  label,
  value,
  onChange,
  hint,
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Why the current value is not acceptable yet. */
  hint?: string | null;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...props} />
      {hint && <span className="text-xs text-[var(--ink-faint)]">{hint}</span>}
    </div>
  );
}

/** The submit button, disabled while the request is in flight. */
export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="mt-1 w-full">
      {children}
    </Button>
  );
}
