import { useId, useState, type ReactNode } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

import { passwordStrength } from '@/lib/validation';
import { cn } from '@/lib/utils';

/**
 * The frame both sign-in screens sit in.
 *
 * Written once because the two forms differ only in their fields: a second
 * copy is how the sign-in and sign-up screens end up with different spacing,
 * different error placement, and the same bug fixed on only one of them.
 *
 * The pitch column is passed in rather than hard-coded, because the sentence
 * that belongs beside "Welcome back" is not the one that belongs beside
 * "Create an account". It is hidden below 900px — see `auth.css`.
 */
export function AuthCard({
  title,
  subtitle,
  pitch,
  footer,
  error,
  onSubmit,
  children,
}: {
  title: string;
  subtitle?: string;
  /** The left-hand column on a wide screen. */
  pitch?: ReactNode;
  footer?: ReactNode;
  /** The server's own sentence, shown verbatim above the submit button. */
  error?: string | null;
  onSubmit: (event: React.FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-layout">
        {pitch && <div className="auth-pitch">{pitch}</div>}

        <div className="auth-panel animate-fade-in">
          <span className="auth-mark" aria-hidden="true">T</span>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}

          <form onSubmit={onSubmit} className="auth-form" noValidate>
            {children}

            {error && (
              <p role="alert" className="auth-error">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </form>

          {footer && <p className="auth-foot">{footer}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Pitch ─────────────────────────── */

/** The wide-screen column: what this is, and three reasons to believe it. */
export function AuthPitch({
  headline,
  body,
  points,
}: {
  headline: string;
  body: string;
  points: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}) {
  return (
    <>
      <span className="auth-mark auth-mark--lg" aria-hidden="true">T</span>
      <h2 className="auth-pitch-title">{headline}</h2>
      <p className="auth-pitch-sub">{body}</p>
      <ul className="auth-points">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="auth-point">
            <span className="auth-point-mark" aria-hidden="true">
              <Icon className="h-3 w-3" />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ─────────────────────────── Field ─────────────────────────── */

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Sits at the left edge of the field, naming it at a glance. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Why the current value is not acceptable yet. */
  hint?: string | null;
  /** Right-aligned on the label row — a "forgot password?" link, usually. */
  labelAside?: ReactNode;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'>;

/** One labelled field, with an optional inline rule below it. */
export function AuthField({
  id, label, value, onChange, icon: Icon, hint, labelAside, className, ...props
}: FieldProps) {
  const hintId = `${id}-hint`;
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        <span>{label}</span>
        {labelAside}
      </label>
      <div className="auth-input-wrap">
        {Icon && (
          <span className="auth-input-icon" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hint ? hintId : undefined}
          className={cn('auth-input', !Icon && 'auth-input--bare', className)}
          {...props}
        />
      </div>
      {hint && <span id={hintId} className="auth-hint">{hint}</span>}
    </div>
  );
}

/* ─────────────────────────── Password ─────────────────────────── */

/**
 * A password field with a reveal toggle, and optionally a strength meter.
 *
 * The toggle is a real button rather than a checkbox styled as one, so it is
 * reachable by keyboard and announces its own state. It switches the input's
 * `type`, which is the only mechanism browsers honour — masking with a font
 * or a CSS filter leaves the value readable in the accessibility tree.
 */
export function AuthPasswordField({
  id, label, value, onChange, hint, labelAside, showStrength, className,
  autoComplete = 'current-password', ...props
}: Omit<FieldProps, 'icon' | 'type'> & { showStrength?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const strength = passwordStrength(value);
  const meterId = useId();

  // Weak reads as a warning, not as an error: the password is acceptable, and
  // colouring it like a failure argues with the button that will accept it.
  const colour = ['var(--ink-a12)', 'var(--status-danger)', 'var(--status-warning)',
                  'var(--status-info)', 'var(--status-success)'][strength.score];

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        <span>{label}</span>
        {labelAside}
      </label>

      <div className="auth-input-wrap">
        <span className="auth-input-icon" aria-hidden="true">
          <LockIcon />
        </span>
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={showStrength && value ? meterId : undefined}
          {...props}
          className={cn('auth-input auth-input--reveal', className)}
        />
        <button
          type="button"
          className="auth-reveal"
          onClick={() => setRevealed((r) => !r)}
          // The label states the action, and `aria-pressed` states the
          // current state — a screen reader user needs both, and an icon
          // supplies neither. It stays in the tab order: someone typing a
          // password with a keyboard is exactly who most needs to check it.
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showStrength && value && (
        <div
          className="auth-strength"
          id={meterId}
          style={{ ['--strength-colour' as string]: colour }}
        >
          <div className="auth-strength-bars" aria-hidden="true">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className="auth-strength-bar" data-on={strength.score >= step} />
            ))}
          </div>
          {/* Polite, and only the summary: announcing every keystroke of a
              password field is both noisy and a disclosure risk. */}
          <div className="auth-strength-row" role="status" aria-live="polite">
            <span className="auth-strength-label">{strength.label}</span>
            {strength.advice && <span className="auth-strength-advice">{strength.advice}</span>}
          </div>
        </div>
      )}

      {hint && <span className="auth-hint">{hint}</span>}
    </div>
  );
}

/** Drawn here rather than imported so the field has no icon prop to forget. */
function LockIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/* ─────────────────────────── Submit ─────────────────────────── */

/** The submit button, disabled while the request is in flight. */
export function AuthSubmit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="auth-submit" disabled={pending}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}
