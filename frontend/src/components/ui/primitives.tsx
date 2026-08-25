/**
 * Shared UI primitives.
 *
 * Before these existed the app had six avatar implementations, four
 * hand-rolled empty states, and eighteen panels with their border and
 * background written inline. Every screen builds from these instead, so the
 * look is defined in one place and changing it changes everywhere.
 */
import { cn } from '@/lib/utils';
import { hueFor } from '@/lib/hue';

type Div = React.HTMLAttributes<HTMLDivElement>;

/* ─────────────────────────── Surface ─────────────────────────── */

export interface SurfaceProps extends Div {
  /** Visual weight. `dashed` reads as "nothing here yet". */
  variant?: 'solid' | 'dashed';
  size?: 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /** Lift and warm on hover — for surfaces that are clickable. */
  interactive?: boolean;
  raised?: boolean;
  as?: 'div' | 'section' | 'article';
}

const PAD = { none: '', sm: 'surface-p-sm', md: 'surface-p-md', lg: 'surface-p-lg', xl: 'surface-p-xl' };

/** The one panel. Everything card-shaped in the app is a Surface. */
export function Surface({
  variant = 'solid', size = 'md', padding = 'md',
  interactive, raised, as: Tag = 'div', className, children, ...rest
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        'surface',
        size === 'lg' && 'surface--lg',
        size === 'sm' && 'surface--sm',
        variant === 'dashed' && 'surface--dashed',
        interactive && 'surface--interactive',
        raised && 'surface--raised',
        PAD[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────── PageHeader ─────────────────────────── */

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Small uppercase pill above the title. */
  eyebrow?: React.ReactNode;
  /** A plain line above the title — a greeting, a count, a breadcrumb. */
  kicker?: React.ReactNode;
  /** Right-aligned actions (a button, usually). */
  actions?: React.ReactNode;
  /** `display` for top-level pages, `section` for headings within one. */
  level?: 'page' | 'section';
  className?: string;
}

/**
 * The header every screen uses.
 *
 * `kicker` is a plain line above the title — a greeting, a count, a "back to"
 * breadcrumb. `eyebrow` is the pill, for the rare page that wants one. The
 * page title used to be `font-brand text-3xl md:text-4xl gradient-text`,
 * which put it in a different size *and* a different treatment from the two
 * screens that hand-rolled their own headers, so the heading jumped between
 * tabs.
 */
export function PageHeader({
  title, subtitle, eyebrow, kicker, actions, level = 'page', className,
}: PageHeaderProps) {
  if (level === 'section') {
    return (
      <div className={cn('page-head', className)}>
        <div className="page-head-text">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-sub">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    );
  }

  return (
    <div className={cn('page-head', className)}>
      <div className="page-head-text">
        {eyebrow && <div className="mb-3"><span className="eyebrow">{eyebrow}</span></div>}
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────── EmptyState ─────────────────────────── */

export interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Tint the icon with the accent when the empty state invites an action. */
  tone?: 'accent' | 'muted';
  className?: string;
}

export function EmptyState({
  icon: Icon, title, description, action, tone = 'accent', className,
}: EmptyStateProps) {
  const accent = tone === 'accent';
  return (
    <Surface variant="dashed" padding="none" className={cn('text-center px-6 py-12', className)}>
      <div
        className="h-11 w-11 rounded-2xl mx-auto mb-3.5 flex items-center justify-center"
        style={accent
          ? { background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }
          : { background: 'var(--ink-a04)', border: '1px solid var(--line)' }}
      >
        <Icon className="h-5 w-5" style={{ color: accent ? 'var(--accent-400)' : 'var(--ink-a12)' }} />
      </div>
      <p className="text-[13px] font-medium text-[var(--ink-muted)]">{title}</p>
      {description && (
        <p className="text-[11.5px] text-[var(--ink-ghost)] mt-1.5 max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Surface>
  );
}

/* ─────────────────────────── Avatar ─────────────────────────── */

export interface AvatarProps {
  /** Seeds the fallback colour, so one person is one colour app-wide. */
  seed?: string | null;
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ seed, src, name, size = 'md', className }: AvatarProps) {
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();
  return (
    <span
      className={cn('avatar', `avatar--${size}`, className)}
      style={{ ['--av-h' as string]: String(hueFor(seed ?? name)) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initial}
    </span>
  );
}

/* ─────────────────────────── Chip ─────────────────────────── */

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'latex' | 'success' | 'danger';
  mono?: boolean;
}

export function Chip({ tone = 'neutral', mono, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn('chip', tone !== 'neutral' && `chip--${tone}`, mono && 'chip--mono', className)}
      {...rest}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────── Stats ─────────────────────────── */

export interface StatItem {
  label: string;
  value: React.ReactNode;
  /** Dates and other long values need a smaller face to fit. */
  small?: boolean;
}

export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn('stat-strip', className)}>
      {items.map(({ label, value, small }) => (
        <div key={label} className="stat-cell">
          <div className="stat-value" style={small ? { fontSize: '0.95rem', paddingTop: '0.45rem' } : undefined}>
            {value}
          </div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── IconButton ─────────────────────────── */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'neutral' | 'danger';
  /** Reveal on hover of the nearest `.group` ancestor. */
  revealOnHover?: boolean;
}

export function IconButton({ tone = 'neutral', revealOnHover, className, ...rest }: IconButtonProps) {
  return (
    <button
      className={cn(
        'icon-btn',
        tone === 'danger' && 'icon-btn--danger',
        revealOnHover && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        className,
      )}
      {...rest}
    />
  );
}

/* ─────────────────────────── PillToggle ─────────────────────────── */

export interface PillToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Names the setting for screen readers — the switch carries no visible text. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * A switch for one on/off setting.
 *
 * A `<div role="switch">` rather than a `<button>`: the browser's default
 * button styling (its own border, background and active state) fought the
 * track on every platform, and there is nothing to submit. Keyboard support
 * is therefore supplied by hand — Enter and Space both toggle, as they would
 * on a real button.
 *
 * All of its geometry and motion live in `.pill-toggle`; the checked state is
 * carried on `aria-checked`, so the same attribute drives assistive tech and
 * the styling, and the two cannot fall out of step.
 */
export function PillToggle({ checked, onChange, label, disabled, className }: PillToggleProps) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-label={label}
      /* The same string as the accessible name, as a tooltip: the switch
         carries no visible text, so a sighted user pointing at it had
         nothing to tell them what it turns on. */
      title={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      className={cn('pill-toggle', className)}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={event => {
        if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onChange(!checked);
      }}
    >
      <span className="pill-toggle-thumb" />
    </div>
  );
}

/* ─────────────────────────── IdentityBanner ─────────────────────────── */

export interface IdentityBannerProps {
  seed: string;
  name: string;
  handle?: string | null;
  bio?: string | null;
  /** Placeholder shown when the person has no bio. */
  bioFallback?: string;
  avatarUrl?: string | null;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The account header used by both your own profile and public ones.
 * The mesh hue is derived from `seed`, so a person looks the same wherever
 * they appear.
 */
export function IdentityBanner({
  seed, name, handle, bio, bioFallback = 'No bio yet.',
  avatarUrl, meta, actions, className,
}: IdentityBannerProps) {
  return (
    <div className={cn('identity-banner', className)} style={{ ['--id-h' as string]: String(hueFor(seed)) }}>
      <div className="identity-mesh" aria-hidden="true" />
      <div className="identity-inner">
        <Avatar seed={seed} src={avatarUrl} name={name} size="xl" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="font-brand text-2xl md:text-3xl tracking-tight text-[var(--ink)] leading-none">{name}</h1>
            {handle && <Chip tone="accent" mono>@{handle}</Chip>}
          </div>
          {bio
            ? <p className="text-sm text-[var(--ink-muted)] leading-relaxed max-w-lg">{bio}</p>
            : <p className="text-sm text-[var(--ink-ghost)] italic">{bioFallback}</p>}
          {meta && (
            <div className="flex items-center gap-3 mt-2.5 flex-wrap text-[11.5px] text-[var(--ink-faint)]">{meta}</div>
          )}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────── DocTypeIcon ─────────────────────────── */

export type DocType = 'mdx' | 'latex';

/** Accent variables for a document type — one definition, used everywhere. */
export function docTypeVars(type: DocType): React.CSSProperties {
  return type === 'latex'
    ? ({
        '--doc-accent': 'var(--latex-500)',
        '--doc-accent-2': 'var(--latex-300)',
        '--doc-accent-soft': 'var(--latex-soft)',
        '--doc-accent-line': 'var(--latex-500)',
        '--doc-accent-dim': 'var(--latex-500)',
      } as React.CSSProperties)
    : ({
        '--doc-accent': 'var(--accent-500)',
        '--doc-accent-2': 'var(--accent-300)',
        '--doc-accent-soft': 'var(--accent-soft)',
        '--doc-accent-line': 'var(--accent-line)',
        '--doc-accent-dim': 'var(--accent-400)',
      } as React.CSSProperties);
}

const DOC_SIZE = { sm: 'h-8 w-8 rounded-lg', md: 'h-9 w-9 rounded-lg', lg: 'h-11 w-11 rounded-xl' };

export function DocTypeIcon({
  type, size = 'md', icon: Icon, className,
}: {
  type: DocType;
  size?: 'sm' | 'md' | 'lg';
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  className?: string;
}) {
  return (
    <span
      className={cn('flex items-center justify-center shrink-0', DOC_SIZE[size], className)}
      style={{ ...docTypeVars(type), background: 'var(--doc-accent-soft)', border: '1px solid var(--doc-accent-line)' }}
    >
      <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} style={{ color: 'var(--doc-accent)' }} />
    </span>
  );
}
