/**
 * Shared UI primitives.
 *
 * Before these existed the app had six avatar implementations, four
 * hand-rolled empty states, and eighteen panels with their border and
 * background written inline. Every screen builds from these instead, so the
 * look is defined in one place and changing it changes everywhere.
 */
import { forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { hueFor } from '@/lib/hue';

type Div = React.HTMLAttributes<HTMLDivElement>;

/* ─────────────────────────── Surface ─────────────────────────── */

export interface SurfaceProps extends Div {
  /** Visual weight. `dashed` reads as "nothing here yet". */
  variant?: 'solid' | 'dashed';
  /** Corner: `sm` for rows, `md` for cards and panels, `lg` for page-level panels. */
  size?: 'sm' | 'md' | 'lg';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  as?: 'div' | 'section' | 'article';
}

const PAD = { none: '', sm: 'surface-p-sm', md: 'surface-p-md', lg: 'surface-p-lg', xl: 'surface-p-xl' };

/** The one panel. Everything card-shaped in the app is a Surface. */
export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface({
  variant = 'solid', size = 'md', padding = 'md', as: Tag = 'div', className, children, ...rest
}, ref) {
  return (
    <Tag
      ref={ref}
      className={cn(
        'surface',
        size === 'lg' && 'surface--lg',
        size === 'sm' && 'surface--sm',
        variant === 'dashed' && 'surface--dashed',
        PAD[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

/* ─────────────────────────── Page ─────────────────────────── */

/**
 * The width and padding of an app screen. `narrow` is the one permitted
 * exception, for single-column forms. Marketing pages use bands, not this.
 */
export function Page({ width = 'default', className, ...rest }: Div & { width?: 'default' | 'narrow' }) {
  return <div className={cn('page-shell', width === 'narrow' && 'page-shell--narrow', className)} {...rest} />;
}

/* ─────────────────────────── DetailRow ─────────────────────────── */

/** A labelled fact: the label and the value on one baseline. */
export function DetailRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('detail-row', className)}>
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

/** What a fact says when it has no value yet — and, where it helps, how to give it one. */
export function DetailEmpty({ children }: { children: React.ReactNode }) {
  return <span className="detail-empty">{children}</span>;
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
        {eyebrow && <div className="mb-3"><Chip size="md" caps tone="accent">{eyebrow}</Chip></div>}
        {kicker && <p className="page-kicker">{kicker}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

/* ─────────────────────────── Refreshing ─────────────────────────── */

/**
 * "This list is being re-fetched right now."
 *
 * `isLoading` is only true on the *first* fetch of a key with nothing cached.
 * Every fetch after that — coming back to a tab, invalidating after a write —
 * leaves `isLoading` false and the previous data on screen, so the list sat
 * there looking settled while it was out of date. Skeletons are wrong for
 * that case: blanking a list the reader is already looking at to redraw the
 * same rows is worse than the staleness. This says so instead, quietly, and
 * keeps the content in place.
 */
export function Refreshing({ active, label = 'Refreshing' }: { active: boolean; label?: string }) {
  if (!active) return null;
  return (
    <span className="refreshing" role="status" aria-live="polite">
      <span className="refreshing-dot" aria-hidden="true" />
      {label}
    </span>
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
  /**
   * `card` — a dashed card in a list or page. `pane` — no chrome, ghosted,
   * centred in the whole of a work surface (the preview before anything is
   * written), where a card would read as content.
   */
  variant?: 'card' | 'pane';
  className?: string;
}

export function EmptyState({
  icon: Icon, title, description, action, tone = 'accent', variant = 'card', className,
}: EmptyStateProps) {
  const accent = tone === 'accent';
  if (variant === 'pane') {
    return (
      <div className={cn('empty-state--pane', className)}>
        <Icon className="h-7 w-7" />
        <p>{title}</p>
        {description && <p className="empty-state--pane-description">{description}</p>}
        {action}
      </div>
    );
  }
  return (
    <Surface variant="dashed" padding="none" className={cn('empty-state', className)}>
      <div className={cn('empty-state-icon', accent && 'empty-state-icon--accent')}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
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
  /** `circle` where the surrounding chrome is round (the nav pill, the photo picker). */
  shape?: 'rounded' | 'circle';
  /**
   * `seeded` is the person's own hue. `accent` and `muted` exist because the
   * nav and the photo picker drew their own avatars in those colours; see
   * LEDGER A-09 on making every avatar seeded.
   */
  tone?: 'seeded' | 'accent' | 'muted';
  /** Alt text when the picture is meaningful on its own (not beside the name). */
  alt?: string;
  className?: string;
}

export function Avatar({
  seed, src, name, size = 'md', shape = 'rounded', tone = 'seeded', alt, className,
}: AvatarProps) {
  const initial = (name?.trim()?.[0] || 'U').toUpperCase();
  // A picture that fails to load falls back to the initial rather than a
  // broken-image glyph — the behaviour the Radix avatar this replaced had.
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = !!src && failed !== src;
  return (
    <span
      className={cn(
        'avatar', `avatar--${size}`,
        shape === 'circle' && 'avatar--circle',
        tone !== 'seeded' && `avatar--${tone}`,
        className,
      )}
      style={tone === 'seeded' ? { ['--av-h' as string]: String(hueFor(seed ?? name)) } : undefined}
      aria-hidden={alt ? undefined : true}
      role={alt ? 'img' : undefined}
      aria-label={alt}
    >
      {showImage ? <img src={src} alt="" onError={() => setFailed(src)} /> : initial}
    </span>
  );
}

/* ─────────────────────────── Chip ─────────────────────────── */

export type ChipTone = 'neutral' | 'quiet' | 'outline' | 'accent' | 'latex' | 'success' | 'danger' | 'brand' | 'doc';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * `neutral` a filled well · `quiet` a faint wash · `outline` a hairline only ·
   * `accent`/`latex`/`success`/`danger` the status tints · `brand` takes the
   * nearest `--brand` (a provider's own colour).
   */
  tone?: ChipTone;
  /** `xs` a 9px badge · `sm` the 24px chip · `md` a hero-scale label. */
  size?: 'xs' | 'sm' | 'md';
  mono?: boolean;
  /** Tracked capitals — for kind badges and eyebrows. */
  caps?: boolean;
}

/** A label that describes — a tag, a handle, a status. Pills describe; rounded rectangles act. */
export function Chip({ tone = 'neutral', size = 'sm', mono, caps, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={cn('chip', `chip--${size}`, tone !== 'neutral' && `chip--${tone}`, mono && 'chip--mono', caps && 'chip--caps', className)}
      {...rest}
    >
      {children}
    </span>
  );
}

export interface ChipButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ChipTone;
  size?: 'sm' | 'md';
  /** Chosen, in the accent's quiet form. Reported with aria-pressed. */
  selected?: boolean;
  /** `rounded` for an option among options (it acts); `pill` for a suggestion or a state. */
  shape?: 'pill' | 'rounded';
}

/**
 * A chip you can press: a suggestion that fills a field, a state you can flip,
 * an option in a set. One component for what were `.doc-chip--action`,
 * `.people-chip`, `.orail-chip`, `.write-pop-ask`, `.topic-try` and `.pdf-choice`.
 */
export const ChipButton = forwardRef<HTMLButtonElement, ChipButtonProps>(function ChipButton({
  tone = 'quiet', size = 'sm', selected, shape = 'pill', className, type = 'button', ...rest
}, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('chip', 'chip-btn', `chip--${size}`, tone !== 'neutral' && `chip--${tone}`, shape === 'rounded' && 'chip--rounded', className)}
      data-selected={selected || undefined}
      aria-pressed={selected === undefined ? undefined : selected}
      {...rest}
    />
  );
});

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
            <h1 className="identity-name">{name}</h1>
            {handle && <Chip tone="accent" mono>@{handle}</Chip>}
          </div>
          {bio
            ? <p className="identity-bio">{bio}</p>
            : <p className="identity-bio identity-bio--empty">{bioFallback}</p>}
          {meta && (
            <div className="identity-meta">{meta}</div>
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

export function DocTypeIcon({
  type, size = 'md', icon: Icon, className,
}: {
  type: DocType;
  size?: 'sm' | 'md' | 'lg';
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  className?: string;
}) {
  return (
    <span className={cn('doc-type-icon', `doc-type-icon--${size}`, className)} style={docTypeVars(type)}>
      <Icon className={size === 'lg' ? 'h-5 w-5' : size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  );
}
