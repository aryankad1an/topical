# UI/UX audit ledger

Run by the `uiux` skill in audit mode (`.claude/skills/uiux/`). It started on 2026-09-30 from commit `25562bd`.

## PRIMITIVE COVERAGE

The measure is a proxy defined in `audit.md`: P ÷ (P + R).
- **P** = JSX instances of exports from `components/ui`.
- **R** = host elements carrying `className=`/`style=`.

| area | before | after |
|---|---|---|
| shell | 20.4% (11 / 43) | — |
| document | 12.0% (37 / 271) | — |
| workspace | 27.1% (19 / 51) | — |
| community | 5.1% (7 / 130) | — |
| marketing | 0.7% (1 / 134) | — |
| account | 27.9% (48 / 124) | — |
| auth | 0.0% (0 / 33) | — |
| **all** | **13.5% (123 / 786)** | — |

## How every batch was verified

- **Pixel harness.** A Playwright capture runs the real app against fixture API responses with a frozen clock and reduced motion, in the scratchpad (not in the repo). It covers 28 route states × 360/1280 × light/dark, which is 110 full-page screenshots plus computed-style fingerprints per element. Each batch is diffed against the baseline taken at `25562bd`. A capture that differs is re-captured once, and only a diff that persists counts. "0 differing" means pixel-identical at a threshold of 8/255 per channel.
- **CSS gate.** The build's `dist/assets/*.css` is diffed rule-by-rule, with comments stripped, against the HEAD build.
- **Lint and typecheck.** `npm run lint` must stay at the baseline of 0 errors / 6 pre-existing warnings, and `npx tsc --noEmit` must stay clean.

## Findings

Status: **fix** = fixed in the batch that lists it · **ask** = needs your decision (see Asks) · **wontfix** = a documented exception.

### Batch 1 — tokens + global/base styles

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| TK-01 | P1 | components/ui/dialog.tsx:22,39 | Radix dialog on `z-50`, under the nav's `z-[100]`: the nav painted above every modal's scrim | dialog + scrim on `--z-modal` | fix |
| TK-02 | P2 | styles/*.css (16 rules), routes/__root.tsx | 16 raw `z-index` values across 5 files; the layer order lived nowhere | `--z-*` layer scale in tokens.css (values preserved), all migrated | fix |
| TK-03 | P2 | styles/pages.css, editor.css, doc-meta.css, primitives.css, tokens.css (38 decls) | raw durations/easings (`0.16s`, `0.35s cubic-bezier(…)`, `1.4s`…) | `--dur-enter/-overlay/-panel/-theme/-reveal/-underline/-flash/-spin/-pulse/-caret/-shimmer/-blink`, `--stagger`, `--ease-panel`; 4 near-values snapped (150→140, 200/250→180, 1.1→1.05s caret, 260→300 preview) | fix |
| TK-04 | P2 | lib/theme.ts:823 | theme wipe hard-coded `480` + a literal copy of `--ease-out` | reads `--dur-theme-wipe`/`--ease-out` from the tokens | fix |
| TK-05 | P2 | buttons.css:85,99; pages.css:1504 | raw white highlight `rgba(255,255,255,.18/.20)` | `--highlight-inset(-strong)` | fix |
| TK-06 | P2 | document.css:590 | raw theorem violet `rgba(122,92,168,…)` | `--theorem-def-rgb` | fix |
| TK-07 | P2 | document.css:698–728 | raw print colours | `--print-*` tokens (deliberately theme-invariant) | fix |
| TK-08 | P1 | routes/__root.tsx:298 | editor shell `h-screen` (100vh): on mobile the status bar sat under the browser's toolbar | `h-dvh`; `min-h-dvh` for the page shell, index, about; loading states `min-h-[Ndvh]`; ⌘K `padding-top: 14dvh` | fix |
| TK-09 | P0 | pages.css:554 | global `textarea:focus-visible` ring was 1px `--accent-line` (~1.5:1, under the 3:1 floor) | `--focus-border` (accent-400); `--focus-ring` token added for fields | fix |
| TK-10 | P2 | tokens.css | no spacing scale (only `--gutter`) | `--space-*` on the 4px ladder, for primitives | fix |
| TK-11 | P3 | tokens.css:199 | `--radius-legacy` defined, used nowhere | deleted | fix |
| TK-12 | P0 | tokens.css:59 | `--accent-ink` on `--accent-400` (light) = **4.24:1**. Every primary button label is under 4.5:1 | needs a token value change | **ask A-01** |
| TK-13 | P0 | tokens.css:32–33 | `--ink-faint` (3.42:1 on `--bg`) is used as **text** 95× and `--ink-ghost` (2.24:1) 58× | needs token values / restricting ghost to non-text | **ask A-02** |
| TK-14 | P1 | tokens.css:56 | `--accent-400` as text on `--bg` = 4.03:1 (8 rules, e.g. step numerals) | use `--accent-500` for accent text (5.48:1) | **ask A-03** |
| TK-15 | P1 | tokens.css:24–26 | control borders `--line`/`--line-strong` measure 1.39/1.77:1 against their surface, under the 3:1 non-text floor (WCAG 1.4.11) | needs a token value change | **ask A-04** |
| TK-16 | P2 | tokens.css:422 | `body { overflow-x: hidden }` masks horizontal overflow (it hid the 360px community overflow, CM-01). `.auth-shell` depends on it | move the clip to `.auth-shell` only | **ask A-05** |
| TK-17 | P2 | tokens.css:222 | shadcn bridge `--accent` is a *neutral* fill, colliding in name with the brand accent | rename (e.g. `--shadcn-accent`) | **ask A-06** (token rename) |
| TK-18 | P3 | tokens.css | component styles live in the token file (`.glass-card`, `.glass-input`, `.gradient-text`, `.theme-toggle`, `.cta-arrow`, `.mobile-menu-overlay`) | moved with their primitive in batch 2/3 | see PR/SH rows |
| TK-19 | — | tokens.css:475 | `animation-duration: 0.01ms` in the reduced-motion block | the standard "effectively off" technique, not a tunable duration | wontfix |
| TK-20 | — | tokens (all) | colour-token parity light ↔ dark | checked: every colour token exists in both themes | ok |

### Batch 2a — primitives layer, P1 (overlapping primitives and look-alikes of existing ones)

Every row here is a merge: the look-alikes were migrated at **every** call site in the codebase, and the old CSS was deleted behind the CSS gate. "Visible" names a deliberate convergence (one primitive, one look) rather than a regression; each one was reviewed in the pixel diff.

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| PR-01 | P1 | components/ui/button.tsx; styles/buttons.css | Two button systems: a shadcn `Button` (Tailwind palette, `outline`/`destructive`) and 13 CSS aliases of the three tiers (`.accent-btn .cta-btn .glass-btn .btn-subtle .doc-btn .orail-btn .orail-primary .orail-go .editor-save .new-post-btn .auth-submit .toolbar-toggle .orail-add`), sizes scattered over 4 files | One `Button`: `variant` primary/secondary/ghost/dashed/danger, `size` xs/sm/md/lg/xl/hero (measured from what rendered), `width`, `shape`, `density`, `elevation`, `tone`, `loading`, `active`, `asChild`; 41 call sites migrated, 33 dead rules deleted | fix |
| PR-02 | P1 | components/ui/icon-button.tsx | 8 aliases for the ghost icon control (`.toolbar-btn .icon-btn .orow-tool .vote-btn .detail-close-btn .theme-toggle .auth-reveal .nav-kbd`); most declared sizes silently overridden by the 40px touch floor | `IconButton` sizes xs 18 / sm 28 / md 30 / lg 40 (what rendered), `tone`, `active`, `width="narrow"`, `revealOnHover`; 38 call sites | fix |
| PR-03 | P1 | DocumentCard, PostCard, PostDetail | delete buttons revealed **only** on hover (`opacity-0 group-hover:opacity-100`): unreachable on touch | `revealOnHover` hides only under `@media (hover: hover)`, and `:focus-within` reveals it | fix |
| PR-04 | P0 | PostCard:40,54; PostDetail:112,127,129 | vote and close buttons had no accessible name (icon only / `title` only) | `aria-label` (required by `IconButton`'s type) | fix |
| PR-05 | P2 | 20 files | 20 hand-rolled `Loader2 animate-spin` at 9 sizes + a second ring spinner (`.detail-spinner`) | `Spinner` (8 sizes, 5 tones, labelled) and `LoadingState` page/region/inline; Button `loading` | fix |
| PR-06 | P1 | ui/avatar.tsx, __root.tsx (`.nav-avatar`), primitives Avatar | three avatar implementations | one `Avatar` (+ `shape`, `tone`, image-error fallback that the Radix one had); Radix avatar deleted | fix |
| PR-07 | P1 | label.tsx, `.auth-label` `.dialog-label` `.pdf-field-label` `.write-pop-label` | four label faces; shadcn's set fields at a different size from every other form | `Label` (`requirement` word, `aside` slot, `size`), `Field` (label/control/hint/error/count), `FieldGroup` | fix |
| PR-08 | P1 | input.tsx, `.glass-input .auth-input .search-input .orail-input .find-input .ai-assist-input .write-pop-input` | seven field looks; shadcn `Input` utilities lost to `.glass-input` | `Input`/`Textarea` sm/md/lg × `well`/`bare`/`file`, leading/trailing slots, focus tokens; `SearchField` (clear button, Escape-to-clear opt-in); 22 call sites | fix |
| PR-09 | P2 | CommandPalette, AiAssist | the menu filter row drawn twice (`.cmdk-input-row`, `.ai-assist-search`) | `MenuSearch` md/sm | fix |
| PR-10 | P0 | AiAssist:186,255; CoAuthorsDialog:66; PostDetail:205; providers:156,177; WritePopover:151; OutlineRail:314 | fields with no label (placeholder only) | `aria-label` on each | fix |
| PR-11 | P2 | ExportPdfDialog `.pdf-toggle` | native checkboxes in a hand-rolled label (MISSING toggle category) | `Checkbox` (label, note, accent box) | fix |
| PR-12 | P1 | card.tsx vs Surface | Card and Surface were the same sheet declared twice; Card lifted on hover though nothing on it was clickable | `Card` composes `Surface`; slots tokenised; `Surface` forwards refs and lost two unused booleans | fix |
| PR-13 | P1 | `.segmented .community-tabs .sort-pill .topic-format .method-switch` | five implementations of one-of-N | `Segmented` tray/pills × md/sm/xs, `iconOnly`, `fill`, `aria-pressed`; 6 call sites | fix |
| PR-14 | P1 | `.doc-chip .people-chip .orail-chip .write-pop-ask .topic-try .pdf-choice .eyebrow .orail-kind .provider-default-chip` | nine chip look-alikes beside `Chip` | `Chip` (+ size xs/sm/md, `caps`, tones quiet/outline/brand) and `ChipButton` (selected, rounded option shape) | fix |
| PR-15 | P2 | components/ui | no barrel; primitives imported file by file | `components/ui/index.ts`; every importer uses it | fix |
| PR-16 | P2 | primitives.tsx Surface | 2 unused booleans (`interactive`, `raised`) + `--surface-accent-line` phantom hook | deleted | fix |
| PR-17 | P3 | 13 removed rules | dead appearance rules that never painted (cascade losers): `.theme-toggle:hover`, `.nav-kbd:hover`, `.vote-btn:hover`, `.orow-tool--go/--add:hover`, `.orail-primary--stop`, `.topic-format` accent state, `.doc-btn--primary` fill, `rounded-full`/`h-9 px-4 text-xs` utilities under `.accent-btn`/`.cta-btn` | deleted with their aliases; rendered result kept | fix |
| PR-18 | P0 | editor.css `.editor-title:focus` | the title field's only focus indicator was a 4% wash | inset 1px `--focus-border` ring | fix |
| PR-20 | P2 | community.tsx:247, PostDetail.tsx:214 | "Start a discussion" and the comment "Post" button render hero type (17px) in a 40px box: the size utilities they were written with (`h-9 px-4 text-xs`) lost to `.cta-btn` | kept as rendered (`size="hero"` + the height) | **ask A-07** |
| PR-21 | P2 | EditorHeader Save/Edit, DocumentCard Open | written as primary (`.accent-btn`, `.doc-btn--primary`) but **render secondary**: the secondary rule was listed later in the same file and won | kept as rendered (`variant="secondary"`) | **ask A-08** |
| PR-22 | P3 | __root nav avatar, ProfileEditorFields picker | avatars in a fixed accent / grey instead of the person's own seeded hue used everywhere else | kept (`tone="accent"` / `"muted"`) | **ask A-09** |
| PR-19 | P1 | ui/dialog.tsx vs NewPostDialog, PostDetail, ExportPdfDialog, CommandPalette | hand-rolled modal overlays beside the Radix `Dialog`: no focus trap, no `aria-modal` on three | migrating changes behaviour (focus trap, portal, return focus) | **ask A-10** |

**Visible convergences in 2a** (each a small, deliberate change; listed so they can be vetoed):
- Buttons sit on measured sizes:
  - Secondary links that were 36px tall are now 40 (`md`).
  - The nav "Sign in" went 34.6 → 40, so the nav's controls share one height.
  - The PDF submit went 40 → 44 (`xl`).
- Shadcn-styled buttons ("Change password", "Change photo", "Skip for now", dialog footers) took the app's tiers: white paper, 600 weight, 9px corners.
- The ⌘K key is a 40px icon button (it was 43 wide). The mobile menu toggle went 34 → 30, matching the theme switch beside it.
- Inputs moved onto the 15px well, and the projects search is 8px wider (208px).
- The AI panel and write popover fields sit on the same well instead of `--ink-a04` / `--bg` tints.
- The write popover's method switch became the tray `Segmented`: a raised chosen item instead of an accent wash.
- Pressable chips are weight 500. The hero suggestions were 400 and static chips are 600. The neutral chip hover is one look everywhere.
- Spinners are one family. The post-detail ring is now the standard spinner. The document route's loader went 28 → 48px, centred like every page loader.
- Profile cards no longer lift on hover. Their shadow is `--shadow-xs` like every other card.

### Batch 2b — primitives layer, P2 (missing categories, quality bar)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| PR-23 | P2 | community.tsx, projects.tsx | skeletons hand-built from `.skeleton` divs with inline geometry; lessons loading was `glass-card animate-pulse` (a pulse, not the product's sweep) | `Skeleton` (`width`/`height` as data, `radius`); 13 call sites | fix |
| PR-24 | P2 | EditorHeader, Toolbar, SlashMenu, CommandPalette, AiAssist, NewPostDialog, Collaborators | MISSING menu: seven panels drew their own rows, four caption styles, three "no results" lines; hover styles disagreed (accent on one, neutral on another) | `MenuPanel` (origin, inset) · `MenuLabel` · `MenuItem` (icon, trailing, `active` keyboard cursor, `checked`, `asChild`) · `MenuEmpty`; panels keep only their placement rules | fix |
| PR-25 | P2 | Toolbar ×4, FindBar, WritePopover, PostDetail, Collaborators | four hand-drawn rules | `Divider` vertical/horizontal | fix |
| PR-26 | P2 | profile_.edit, providers, u.$username; OutlineRail/OutlineProposal/WritePopover; TopicHero | MISSING link: three identical "← Back" links in Tailwind; `.orail-link` ×4; `.hero-aside-link` | `TextLink` quiet/underline · `BackLink` | fix |
| PR-27 | P2 | AuthCard, ChangePasswordCard, ExportPdfDialog | MISSING error: three error presentations | `Notice` well/inline × danger/warning/success/info, `role=alert` | fix |
| PR-28 | P2 | projects.tsx | publish and delete confirms assembled by hand with an inline-styled dialog; delete could be closed mid-request | `ConfirmDialog` (tone, busy label, locked while busy) | fix |
| PR-29 | P2 | CoAuthorsDialog, ImageDialog, ShortcutsSheet | `.dialog-dark` `!important` overrides and per-call title/description sizes | `DialogContent material="solid"`/`size`; `.dialog-title`/`.dialog-description` | fix |
| PR-30 | P2 | 6 routes | `.page-shell` written by hand per route | `Page` (`width="narrow"`) | fix |
| PR-31 | P2 | profile.tsx | `.detail-row` markup by hand | `DetailRow`, `DetailEmpty` | fix |
| PR-32 | P1 | profile.tsx:110, index.tsx:107 | raw `chip chip--accent` spans — after 2a moved chip sizing onto `Chip`, these rendered cramped (regression caught by the harness) | `Chip` | fix |
| PR-33 | P2 | ShortcutsSheet, Toolbar, EditorPage, CommandPalette, SlashMenu, AiAssist | five `kbd` styles | `Kbd` key/cap/fill/bare | fix |
| PR-34 | P2 | primitives.tsx EmptyState, DocTypeIcon, IdentityBanner; __root Toaster | primitives below the quality bar: inline styles, `text-[11.5px]`-style raw values, a toast styled inline at its mount | moved to tokenised classes; the Toaster owns its surface | fix |
| PR-35 | P2 | link.tsx (caught in review) | `cn()` (tailwind-merge) silently dropped `text-link*` classes as conflicting Tailwind `text-*` utilities | renamed to `.link*`; every primitive class list checked against twMerge | fix |
| PR-36 | P3 | — | Tailwind's `text-sm` (14px) and the `--text-sm` token (13px) are two type scales in use at once | unify the scales | **ask A-11** |

Visible in 2b:
- Menus use one hover (neutral) and one keyboard cursor (accent quiet). The slash menu's cursor was a neutral wash; ⌘K's lost its inset outline.
- The lesson picker is a solid menu panel instead of bordered rows on glass.
- Dialog titles are 17px and descriptions `--ink-muted`.
- Delete can no longer be dismissed mid-request.
