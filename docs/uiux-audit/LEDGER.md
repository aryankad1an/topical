# UI/UX audit ledger

Run by the `uiux` skill in audit mode (`.claude/skills/uiux/`). It started on 2026-09-30 from commit `25562bd`.

## PRIMITIVE COVERAGE

The measure is a proxy defined in `audit.md`: P ÷ (P + R).
- **P** = JSX instances of exports from `components/ui`.
- **R** = host elements carrying `className=`/`style=`.

What R still counts after the audit is mostly documented domain geometry, each piece with a single owner (DC-09, WS-05, CM-07, AC-08, MK-02, MK-03, AU-03). Examples are the editor's panes and rail, the forum card, the provider setup stepper, and the hero's `aria-hidden` illustration of the editor (34 elements on its own). The 13px titles that remain wait on A-11.

| area | before | after |
|---|---|---|
| shell | 20.4% (11 / 43) | 68.5% (37 / 54) |
| document | 12.0% (37 / 271) | 54.3% (163 / 300) |
| workspace | 27.1% (19 / 51) | 71.4% (45 / 63) |
| community | 5.1% (7 / 130) | 64.8% (83 / 128) |
| marketing | 0.7% (1 / 134) | 40.0% (36 / 90) |
| account | 27.9% (48 / 124) | 65.6% (107 / 163) |
| auth | 0.0% (0 / 33) | 36.7% (11 / 30) |
| **all** | **13.5% (123 / 786)** | **58.2% (482 / 828)** |

## How every batch was verified

- **Pixel harness.** A Playwright capture runs the real app against fixture API responses with a frozen clock and reduced motion, from `.claude/skills/uiux/harness/` (its output goes to a scratch directory). It covers 36 route states (28 at the start, plus six editor overlays and two empty-document states added during the audit) × 360/1280 × light/dark, which is 126 full-page screenshots plus computed-style fingerprints per element. Each batch is diffed against a baseline captured from a worktree at the previous batch's commit. A capture that differs is re-captured once, and only a diff that persists counts. "0 differing" means pixel-identical at a threshold of 8/255 per channel.
- **CSS gate.** The build's `dist/assets/*.css` is diffed rule-by-rule, with comments stripped, against the HEAD build.
- **Lint and typecheck.** `npm run lint` must stay at the baseline of 0 errors and no new warnings (6 pre-existing at the start, 5 at the end), and `npx tsc --noEmit` must stay clean.

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

### Batch 3a — layout + typography primitives, marketing sections (P2)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| LT-01 | P2 | 19 files | MISSING layout/type primitives: flex/grid/text utilities written on raw elements everywhere | `Row`, `Stack`, `Grid` (literal class tables on the 4px ladder), `Text` (size/tone/weight/leading/italic/truncate/numeric), `Heading`; 73 elements migrated by an AST codemod (`harness/codemod-layout.cjs`) that converts only elements whose classes are pure layout/type utilities — pixel-identical except two half-pixel snaps (10.5/11.5px → 11px metadata) | fix |
| LT-02 | P2 | index.tsx, about.tsx | marketing sections hand-built ×9 (`.band`/`.band-inner`, `.section-head/-title/-sub`, `.step-card`/`.bento-item` + `.bento-icon` + `.card-title`/`.card-body`); about's hero and closing CTA restyled them with inline `style` | `Band` (default/tight/hero), `SectionHead` (hero size, eyebrow, centred, flush), `FeatureCard` (step/bento/wide/feature, footer slot) | fix |
| LT-03 | P2 | index.tsx, about.tsx | two footers that had drifted (wordmark size, brand line on one page only, two copyright forms) | `SiteFooter` with per-page links (visible on /about: the brand line appears) | fix |

### Batch 3b — app shell (P1–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| SH-01 | P2 | routes/__root.tsx:111–190 | nav pill, home link, dividers, mobile bar and mobile menu header styled with inline `style` objects (raw px, a `0.25s` literal, `borderRadius: 100`) | `.site-nav`/`.site-nav-home`/`.mobile-bar`/`.mobile-menu-head` on tokens; `Divider` (new `xs` space) | fix |
| SH-02 | P2 | routes/_authenticated.tsx:47 | signed-out gate drawn with raw utilities | `Stack` + `Text as="h2"` | fix |
| SH-03 | P1 | router (main.tsx) | no not-found or error UI: an unknown URL renders TanStack's bare "Not Found" text with no way back; a thrown error renders nothing designed | add `defaultNotFoundComponent`/`defaultErrorComponent` built from `EmptyState` | **ask A-12** (new behaviour) |
| SH-04 | P1 | components/CommandPalette.tsx:205, routes/__root.tsx:178 | the palette and the mobile menu are hand-rolled fixed overlays (no focus trap; the mobile menu has no Escape) | part of A-10 | **ask A-10** |
| SH-05 | — | routes/__root.tsx:123 `.nav-indicator` | inline `style` on the sliding indicator | measured position (dynamic value) — the documented exception | wontfix |

### Batch 4.1 — document area: panel headers, progress, captions (P1–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| DC-01 | P2 | AiAssist, WritePopover, OutlineProposal, ExportPdfDialog, NewPostDialog, PostDetail | six panels drew their own header strip (icon, title, close) in four styles: two near-identical 11.5px rows, a caps accent caption on the proposal, and `post-detail-header` with a `:first-child` margin hack | `PanelHeader` sm (popovers) / md (sheets, dialogs); the title truncates with an ellipsis (the write popover's did; now all do) | fix |
| DC-02 | P2 | OutlineRail:289, :453 | two hand-built bars (`outline-meter`, `gen-progress`) with their own track/fill rules; the run bar exposed no progress semantics | `Progress` sm/md; the generation bar is now `role=progressbar` with a label and value | fix |
| DC-03 | P2 | AiAssist:259–304 | a private button family (`.ai-btn`, `.ai-btn--primary`): 28px, an ink-tint fill, its own hover and disabled rules | `Button size="xs"` primary/secondary | fix |
| DC-04 | P3 | ShortcutsSheet:91, CoAuthorsDialog:85 | two caps captions with drifted values (11px/0.07em vs 10px/0.09em) | `Heading size="label"` (one caption: 10px/700/0.09em, `--ink-faint`) | fix |
| DC-05 | P3 | FindBar:31 | mono count styled by a page rule | `Text mono size="2xs" tone="faint"`; `.find-count` keeps only its min-width | fix |

Visible in 4.1:
- The proposal panel's header reads "Proposed structure" in the panel-header style, not as an accent caps caption.
- In the write popover, "Write" is now semibold like the rest of the header. The section name stays in full ink.
- The AI result buttons are standard `xs` buttons: about 2px taller, with a surface fill instead of an ink tint.
- The shortcuts captions are 1px smaller, and the co-author caption has 1px more space below it.

Verified with the harness: 0 unexpected diffs. The harness gained six editor-overlay states, `ov-*` (shortcuts, find, AI with and without a selection, export PDF, co-authors), and those are now in the baseline. Two diffs were caught and fixed before the commit:
- `Progress` was `width: 100%` inside a margined flex child, so it overflowed by 24px.
- The md header lost the 20px line-height that `text-sm` used to carry.

Document coverage 12.0% → 52.3%.

### Batch 4.2 — document area: list rows, pane empty state (P2–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| DC-06 | P2 | CoAuthorsDialog:69, :91 | MISSING list-row primitive: the share dialog built its own result and member rows (`share-row`, `share-name`) | `ListRow` plain/filled (new) — pixel-identical | fix |
| DC-07 | P3 | PreviewPane:89, :99 | the preview's two empty states were a private `doc-empty` block. Its sub-line's `11.5px` never applied: `.doc-empty p` (0,1,1) outranked `.doc-empty-sub` (0,1,0), so it rendered at 13px | `EmptyState variant="pane"`; the sub-line now renders at its intended 11.5px | fix |
| DC-08 | P3 | OutlineRail:437 | `orail-add-row` is an outline row's twin, not a button: it matches the row's padding and type and is mirrored by the landing hero's rail | kept as the rail's own row. Folding it into `Button variant="dashed"` would change the rail visibly | wontfix |
| DC-09 | — | EditorPage, OutlineRail, OutlineRow, Toolbar, StatusBar, EditorHeader, PreviewPane | about 120 remaining styled host elements are the editor's own geometry: the panes, the rail and its resizer, the toolbar groups, the outline rows and their grip, the status bar and the peer cursors | domain composites with a single owner. Making each one a primitive would add exports used once | wontfix (documented) |

The harness gained two `doc-blank-*` states, read and write, with an empty document. It is served by id only, so the lists are unchanged.

Document coverage 52.3% → 54.3%.

### Batch 5 — workspace (P1–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| WS-01 | P1 | DocumentCard:160, :213 | look-alike of `DocTypeIcon`: two hand-built format tiles (raw `h-8`/`h-9` boxes with inline `style` for the doc hue) beside the primitive that draws exactly that | `DocTypeIcon` sm (now with the 14px glyph the card used) / md — pixel-identical | fix |
| WS-02 | P2 | DocumentCard:165–170, :220–228 | titles and meta lines as raw `text-[11px] text-[var(--ink-faint)]` utility strings | `Text` (`as="h3"`, size/weight/tone/truncate) in a `Row` — pixel-identical | fix |
| WS-03 | P2 | DocumentCard:221 | the list view's MDX/TEX badge was a private 9.5px rounded tag with an inline-style hue | `Chip size="xs"` with a new `doc` tone (`--doc-accent` from `docTypeVars`). Visible: a 9px pill with a hairline, like every other badge | fix |
| WS-04 | P1 | projects.tsx:241, providers.tsx:91, :211 | `Heading`'s display/section sizes pointed at classes that were never defined (`heading--display`, `heading--section`), so the primitive could not be used for a heading. Three call sites restyled `.section-title` with an inline `fontSize` instead | `Heading` sizes now map to the real classes (`page-title`, `section-title`), plus `subsection` (--text-lg) and `group` (1rem) — pixel-identical | fix |
| WS-05 | — | projects.tsx (`doc-card` skeleton, `workspace-facts`), DocumentCard (`doc-thumb*`, `doc-meta`, `doc-actions`), TopicStarter (`topic-bar`) | the card's miniature, the skeleton that mirrors the card's geometry, the one-line facts row and the topic bar are the workspace's own composites | domain geometry, single owner | wontfix (documented) |

Workspace coverage 27.1% → 71.4%.

### Batch 6 — community (P1–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| CM-02 | P1 | community.tsx:234, :353 | look-alike of `EmptyState`: the posts and lessons tabs drew a private `community-empty` box (faded 40px glyph, ghost line), while the People tab on the same screen used `EmptyState`. The three tabs had two empty states | `EmptyState tone="muted"` (the CTA moves to its `action` slot). Visible: the icon tile and title of the People tab | fix |
| CM-03 | P2 | community.tsx:325, PostCard:110 | two private tag styles (`own-badge`, `lesson-badge`) with drifted sizes | `Chip` quiet: "Yours" is the xs badge; the attached lesson is the sm chip | fix |
| CM-04 | P2 | community.tsx:255, :302, :332 | icon-led counts written as `flex items-center gap-1.5 text-xs text-[var(--ink-ghost)]` utility strings | `Text` gained an `icon` slot (inline-flex or flex, 6px) — pixel-identical | fix |
| CM-05 | P2 | community.tsx:322–330, PostDetail:128–133 | titles, meta rows and the post body as raw type utilities | `Text` + `Row` — pixel-identical | fix |
| CM-06 | P3 | PostDetail:152 | a third caps caption (12px, `tracking-widest`) | `Heading size="label"`. Visible: 10px, like every other group caption | fix |
| CM-07 | — | community.tsx (`community-card` skeleton, `person-card`, `lessons-grid`), PostCard (vote column, meta items), PostDetail (`comment-row`, `attached-lesson-row`) | the forum's own card geometry and its skeleton mirror | domain geometry, single owner | wontfix (documented) |
| CM-08 | P1 | NewPostDialog:52, PostDetail:108 | hand-rolled fixed overlays beside Radix `Dialog` | part of A-10 | **ask A-10** |

Community coverage 5.1% → 64.8%.

### Batch 7 — account (P1–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| AC-01 | P2 | profile.tsx:150, providers.tsx:224 | the connected-provider tile (brand mark, name, Default chip, model) was hand-built twice, with the name as a raw `text-[13px]` utility string | `components/ProviderTile.tsx` (a domain component, with an `actions` slot) used by both screens; the name moved to `.provider-name` — pixel-identical | fix |
| AC-02 | P1 | providers.tsx:104, :137, :148 | the provider picker and the model picker were `<button>`s whose selection lived only in `data-selected`, so a screen reader announced nine identical buttons and never which one was chosen | `aria-pressed` on every option (the contract `ChipButton` and `Segmented` already use) — no visual change | fix |
| AC-03 | P2 | providers.tsx:141 | RECOMMENDED was a private 9.5px tag with an inline-style hue and the word typed in capitals | `Chip size="xs" tone="accent" caps`. Visible: a pill with a hairline | fix |
| AC-04 | P1 | providers.tsx:199 | look-alike of `TextLink`: the "Get a key" link restated the quiet link's colours and hover in utilities | `TextLink asChild size="xs"`. Visible: 4px taller at 360, because the link now takes the body's line-height instead of Tailwind's 16px | fix |
| AC-05 | P3 | providers.tsx:243 | "default" was coloured with an inline `--accent-500` (4.0:1, A-03) | `Text tone="accent"` (`--accent-600`) | fix |
| AC-06 | P2 | profile.tsx:29 | the profile's load-failure path was an unstyled `text-2xl font-bold` "Authentication Error" block | `EmptyState` in a narrow `Page`, with the sign-in action and a plain-language title | fix |
| AC-07 | P3 | profile.tsx, providers.tsx, ProfileEditorFields, ChangePasswordCard | `space-y-*` wrappers | `Stack` — pixel-identical | fix |
| AC-08 | — | providers.tsx (`setup-step` rail, `brand-card`, `model-option`, `key-note`), profile.tsx (`account-identity`), u.$username (`pub-row`), ProfileEditorFields (`avatar-busy`), profile_.edit (username feedback row) | the setup stepper, the two pickers, the identity block and the published-document row each have one owner. The remaining raw `text-[13px]` titles wait on A-11, the two type scales | domain geometry; type blocked by A-11 | wontfix (documented) |

Account coverage 27.9% → 65.6%.

### Batch 8 — marketing (P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| MK-01 | P3 | index.tsx:57, about.tsx:43 | page roots as raw `flex flex-col` wrappers | `Stack` — pixel-identical | fix |
| MK-02 | — | features/home/LiveDocument.tsx (34 elements) | the hero's moving picture of the editor. It reuses the editor's own rail, pane and status vocabulary (`preview-*`) so that it looks like the product, and it is `aria-hidden` | an illustration, not interface: primitives would make it stop resembling the editor | wontfix (documented) |
| MK-03 | — | features/home/TopicHero.tsx | the performed hero: title, ghost text and caret, and the topic bar shared with the workspace's `TopicStarter` | one owner; its controls are already `Button`/`ChipButton`/`TextLink` | wontfix (documented) |

Marketing coverage 0.7% → 40.0%. Most of the remaining raw count is MK-02.

### Batch 9 — auth (P2–P3)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| AU-01 | P2 | login.tsx:65, register.tsx:70, auth.css `.auth-foot a` | look-alike of `TextLink`: the "Create one" / "Sign in" links were bare router links restyled by a descendant selector | `TextLink` gained an `accent` variant at the same `--accent-500` (contrast is A-03) — pixel-identical | fix |
| AU-02 | P3 | AuthCard:51 | the form restated a flex column in CSS | `Stack as="form" gap={4}`; `.auth-form` keeps only its offset. `Row`/`Stack` accept `noValidate` — pixel-identical | fix |
| AU-03 | — | AuthCard (`auth-shell`/`auth-layout`/`auth-panel`, pitch column, strength meter) | the auth shell is already the one shared component for both screens. The strength meter is four discrete segments coloured per score, not a `Progress` | single owner | wontfix (documented) |

Auth coverage 0.0% → 36.7%.

### Batch 10 — community at 360px (P0)

| id | sev | path:line | defect | fix | status |
|---|---|---|---|---|---|
| CM-01 | P0 | community.tsx:150, :261, :273 | every community screen was 8–15px wider than a 360px phone. `body { overflow-x: hidden }` (A-05) hid the scrollbar, so the overflow was **clipped**: the People tab, the right edge of every person card and the end of each bio were cut off. Two causes: the tab switch could not fit "Public Lessons" plus three icons in 296px, and the People grid had no base column count, so its implicit column sized to the longest unbroken line | the tab reads "Lessons" (the line under it already says "N public lessons"); the People grid is `cols={{ base: 1, sm: 2 }}`, so bios truncate. No capture overflows any more | fix |

## Totals

100 findings across 13 commits (`6bd0eff` … `51ee359`).

| | P0 | P1 | P2 | P3 | — | total |
|---|---|---|---|---|---|---|
| fixed | 5 | 17 | 42 | 10 | — | 74 |
| ask | 2 | 6 | 4 | 2 | — | 14 rows → 12 asks |
| wontfix (documented exception) | — | — | — | 1 | 9 | 10 |
| other (informational) | — | — | — | 1 | 1 | 2 |

Remaining unfixed by severity: P0 2 (A-01, A-02) · P1 6 (A-03, A-04, A-10 ×3 rows, A-12) · P2 4 · P3 2, all of them asks.

## Asks — ordered by impact

Each of these changes behaviour, a token value or name, a visible design decision, or the dependencies, so each needs your call.

| # | id | impact | what is asked | rows |
|---|---|---|---|---|
| 1 | A-01 | P0 · every primary button | raise `--accent-ink` on `--accent-400` from 4.24:1 to ≥ 4.5:1 (darken the fill or the label) | TK-12 |
| 2 | A-02 | P0 · ~150 text uses | `--ink-faint` (3.42:1) and `--ink-ghost` (2.24:1) are used as text: darken faint to ≥ 4.5:1 and keep ghost for non-text only | TK-13 |
| 3 | A-10 | P1 · 6 overlays | move the hand-rolled overlays (new post, post detail, export PDF, ⌘K palette, mobile menu) onto Radix `Dialog`: focus trap, `aria-modal`, Escape, focus return. The mobile menu has no Escape at all | PR-19, SH-04, CM-08 |
| 4 | A-12 | P1 · every bad URL or crash | add `defaultNotFoundComponent` / `defaultErrorComponent` built from `EmptyState`; today an unknown URL is TanStack's bare "Not Found" with no way back | SH-03 |
| 5 | A-04 | P1 · every control | control borders (`--line` 1.39:1, `--line-strong` 1.77:1) are under the 3:1 non-text floor | TK-15 |
| 6 | A-03 | P1 · accent text | `--accent-400` as text is 4.03:1: switch accent text to `--accent-500`/`-600`. Some (AC-05) already moved | TK-14 |
| 7 | A-05 | P2 · hides layout bugs | drop `body { overflow-x: hidden }` and clip only `.auth-shell`. It hid CM-01, a clipped 360px layout | TK-16 |
| 8 | A-08 | P2 · one primary per view | Save/Edit (editor) and Open (document card) are written as primary but render secondary. Pick one | PR-21 |
| 9 | A-11 | P3 · blocks the last type migrations | unify Tailwind's `text-sm` (14px) with `--text-sm` (13px); the remaining raw `text-[13px]` titles wait on this | PR-36, AC-08 |
| 10 | A-07 | P2 · two buttons | "Start a discussion" and the comment "Post" render hero type (17px) in a 40px box: make them `lg` | PR-20 |
| 11 | A-09 | P3 · two avatars | the nav avatar and the photo picker use a fixed accent/grey instead of the person's seeded hue | PR-22 |
| 12 | A-06 | P2 · developer clarity | rename the shadcn bridge `--accent` (a neutral fill) so it stops colliding with the brand accent | TK-17 |
| 13 | A-13 | dependency | `@radix-ui/react-avatar` is in `package.json` but imported nowhere (`Avatar` is our own): remove it | — |

## Resolutions (2026-10-07)

You approved every ask with "do it your way", and A-12 with "add it". Each one below was verified with the same harness, plus a text-contrast probe (`harness/contrast.js`, run through `probe.py --themes light,dark`). The probe composites each visible text element's ink, opacity and layered ground across all 126 captures.

### Batch 11 — contrast tokens (A-01 – A-04, P0–P1)

| ask | change | result |
|---|---|---|
| A-01 | `--accent-400` #c25e38 → **#b85a36** (and `--accent-rgb`, `-soft`, `-line`, `-glow`, the PDF terracotta) | white on the primary fill 4.24 → **4.61:1** |
| A-02 | light: muted #6b6459 → #625b51, faint #8e8679 → #6d665c, ghost #b0a897 → #736d61. Dark: muted #a29b8e → #aba598, faint #847d71 → #9e978d, ghost #655f55 → #948f86 | on every resting ground (page, card, well, strip), in both themes: muted ≥ 5.9, faint ≥ 5.0, ghost ≥ 4.5:1. The ramp is tighter but keeps its order |
| A-03 | accent *text* (gutter line markers, footnote marks) → `--accent-500`; the outline "P1" tag → `--accent-600` | icons keep `--accent-400`, which only needs 3:1 |
| A-04 | new `--control-line` (light #8e887c, dark #78746c) on the fields you type into (`Input`/`Textarea` well, the topic bar) | ≥ 3.1:1 against every ground (WCAG 1.4.11). Separating hairlines stay `--line` |
| — | the GitHub highlight.js theme is no longer imported: its compound selectors (`.hljs-title.function_`…) outranked the token mapping and painted light-theme colours into dark code blocks (function names at 2.2:1). The token mapping now covers every class it styled, including its `pre code` padding | |
| — | decorative "·" separators and the providers' logo initials are `aria-hidden`; the active menu row's hint, the outline word counts and the selected provider's model count moved one ink step darker | |

Text elements under 4.5:1 (3:1 when large): **1,221 → 0** across all captures in both themes. The only exclusions are heading anchors at opacity 0 and the editor textarea, whose text is drawn by an overlay.

### Batch 12 — not-found and error screens (A-12, P1)

| ask | change | result |
|---|---|---|
| A-12 | `components/RouteStates.tsx`: `NotFound` and `RouteError`, both built from `EmptyState` in a narrow `Page`, set as the router's `defaultNotFoundComponent` / `defaultErrorComponent` | an unknown URL shows "This page doesn't exist" with a way home, inside the normal shell (it was TanStack's bare "Not Found"). A route that throws shows "Something went wrong on this page" with **Try again** (resets the boundary and reloads the route's data) and **Go to the home page**. Verified by making `/api/posts` return malformed data |

### Batch 13 — modals (A-10, P1) and the post card's keyboard path (P0)

| ask/id | change | result |
|---|---|---|
| A-10 | new `Modal` primitive (`components/ui/modal.tsx`): the caller keeps its own scrim and panel, and Radix Dialog supplies the behaviour. Used by the new-post sheet, the post view, the PDF export sheet, the ⌘K palette and the mobile menu. `useDialogDismiss` (Escape + a hand-made scroll lock) is deleted | behaviour-tested on all five: `role=dialog` + `aria-modal` + a label; focus moves in (the panel itself, or an `autoFocus` field) and **25 Tabs never leave it**; Escape and a click on the scrim close it; the page is scroll-locked; focus returns to the opener when one still exists. Pixel-identical except that the floating nav now sits *under* the post sheets' scrim (it was above it and still clickable) |
| — | the mobile menu closes itself if the window widens past 768px | without this it would vanish (`md:hidden`) while still holding the focus trap |
| PC-01 (P0) | a post could only be opened by a pointer: the card was a `<div onClick>`. The title is now a real button (`community-card-open`, same type and colour, its own focus ring) | Enter on a focused title opens the post, and closing it returns focus there. Pointer behaviour is unchanged |
| PC-02 (P3) | a score of 0 was drawn at `--ink-a12` (about 1.3:1) | 0 and negative scores use `--ink-ghost` (≥ 4.5:1) |

### Batch 14 — no more silent clipping (A-05, P2)

| ask | change | result |
|---|---|---|
| A-05 | `body { overflow-x: hidden }` removed. The auth shell never needed it: its −1rem side margins cancel `<main>`'s padding exactly, and it keeps its own `overflow: hidden` for its decoration. The comment that claimed it relied on `body` is corrected | every route state at **360 / 768 / 1280 / 1920** reports `scrollWidth ≤ clientWidth`. Sign-in, sign-up and the landing page are pixel-identical. A future overflow now scrolls and is flagged instead of being cut off |

### Batch 15 — button sizes, one primary, seeded avatars (A-07, A-08, A-09)

| ask | change | result |
|---|---|---|
| A-07 | "Start a discussion" (empty forum) and the comment "Post" button: `size="hero"` with a height override → `size="lg"` | 13px in a 40px button, like every other in-app action |
| A-08 | decided per view: **Edit** (reading mode) → primary, the only action on that screen. **Save** (writing mode) stays secondary: the outline rail's "Write sections" is that view's primary and the document autosaves. **Open** on a document card stays secondary: the projects page's primary is Start | one primary per view, and the code says what renders |
| A-09 | the nav avatar and the profile photo picker are seeded with the person's id; Avatar's `accent`/`muted` tones and their CSS are deleted | a person is one colour everywhere: nav, people list, comments, profile |

### Batch 16 — naming and dependencies (A-06, A-13)

| ask | change | result |
|---|---|---|
| A-06 | the shadcn bridge's neutral hover fill `--accent` / `--accent-foreground` → `--shadcn-accent` / `--shadcn-accent-foreground`, with the Tailwind key `shadcn-accent`. The dialog close button (its only user) is updated. The bridge's `--primary` and `--ring` still held the pre-A-01 terracotta, so they now follow it | `accent` in this codebase means the brand ramp only. Compiled-CSS gate: one class renamed, the variable blocks changed, nothing else |
| A-13 | `npm uninstall @radix-ui/react-avatar`: nothing imported it (`Avatar` is our own primitive) | `package.json` −1, `package-lock.json` −84 lines (the package and its two private copies of Radix internals, plus `react-use-is-hydrated`) |

### Batch 17 — one type ladder (A-11, P3)

| ask | change | result |
|---|---|---|
| A-11 | Tailwind's `text-*` sizes now resolve to the `--text-*` tokens: 3xs 10 · 2xs 11 · xs 12 · sm 13 · base 15 · md 17 · lg 20 · xl 24 · 2xl 30 · 3xl 38 · 4xl 48 (px). New tokens `--text-3xs` and `--text-2xs`. Each step keeps Tailwind's line-height, so line boxes stay put. `Text` maps onto the same ladder (`md` added), and `cn()` registers the new names with tailwind-merge so a size can never knock out a tone class | `text-sm` and `--text-sm` are the same 13px. Visible: `Text size="sm"` titles (document cards, people, lessons, post bodies) are 1px smaller. The footer wordmark is 17px (was 18px). The signed-out gate keeps 24px (`xl`). The remaining raw `text-[13px]` titles (providers, published documents) are now `Text size="sm"` |
