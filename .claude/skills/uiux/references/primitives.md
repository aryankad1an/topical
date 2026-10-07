# Primitives catalogue

Live catalogue. **Every new or changed primitive updates this file in the same change.** Last updated at the end of the 2026-09-30 audit (batch 10).

- **Directory:** `frontend/src/components/ui/`
- **Index:** `components/ui/index.ts`. Import from `@/components/ui`, never from a file.
- **Styles:**
  - Controls (`btn`, `icon-btn`, `input`, `label`, `field`, `checkbox`, `menu-search`, `segmented`, `spinner`, `loading-state`, `kbd`) are in `styles/buttons.css`, which loads last.
  - Surfaces, cards, avatar and chips are in `styles/primitives.css`.

## Exports

### Layout
| export | use this when… | variants / props |
|---|---|---|
| `Surface` | anything card- or panel-shaped on page ground | `variant` solid/dashed · `size` sm/md/lg (corner) · `padding` none/sm/md/lg/xl · `as` div/section/article · ref |
| `Card` + `CardHeader` `CardTitle` `CardDescription` `CardContent` `CardFooter` | a titled panel | composes `Surface padding="none"`; slots are tokenised |
| `PageHeader` | the header of every app screen, or a section heading | `level` page/section, `title`, `subtitle`, `eyebrow` (a caps accent `Chip`), `kicker`, `actions` |
| `Page` | the width and padding of an app screen | `width` default (68rem) / narrow (46rem, single-column forms) |
| `DetailRow`, `DetailEmpty` | a labelled fact on one baseline; the "not set yet" value | `label` |
| `IdentityBanner` | the header of a page *about a person* (`/u/:username`) | `seed`, `name`, `handle`, `bio`, `avatarUrl`, `meta`, `actions` |
| `Row`, `Stack` | any flex row / column | `gap` (4px ladder: 0–12), `gapX`/`gapY`, `align`, `justify`, `wrap`, `inline`, `as` (incl. `form`, with `noValidate`), ref. Literal class tables, so Tailwind sees every class |
| `Grid` | an n-column grid | `cols` 1–4 plus `sm`/`md`/`lg` breakpoints, `gap` |
| `Band`, `SectionHead`, `FeatureCard` | marketing sections | Band `spacing` default/tight/hero · SectionHead `title`, `subtitle`, `eyebrow`, `size` section/hero, `align` start/center, `flush` · FeatureCard `variant` step/bento/wide/feature, `step`, `icon`, `footer` |
| `PanelHeader` | the strip atop a popover, sheet or dialog: icon, title, close | `size` sm (popover over the document) / md (sheet, dialog); `onClose` + `closeLabel`; the title truncates |

### Type
| export | use this when… | variants / props |
|---|---|---|
| `Text` | any run of text that is not a heading | `size` 3xs–2xl, `tone`, `weight`, `leading`, `italic`, `truncate`, `numeric`, `mono`, `icon` (a leading glyph 6px from the text: a count, a meta item), `as` (p/span/div/h2–h4/time…) |
| `Heading` | a heading | `level` 1–4 (the outline) · `size` display (page title) / section (marketing section) / subsection (--text-lg, a section in an app screen) / group (1rem) / card / label (the 10px caps caption over a group) |

### Controls
| export | use this when… | variants / props |
|---|---|---|
| `Button` | any text button, or a link styled as one (`asChild`) | `variant` primary (the one per view) / secondary / ghost / dashed ("add one") / danger (filled destructive confirm); `size` xs 11px auto · sm 11.5px auto · md 12px@40 · lg 13px@40 · xl 15px@44 · hero 17px; `width` auto/full · `shape` rounded/pill (pill only inside pill chrome) · `density` default/tight · `elevation` flat/float · `tone` neutral/danger (rose tint, first step of a two-step delete) · `loading` · `active` · ref |
| `IconButton` | an icon-only control (ghost tier) | `size` xs 18 · sm 28 · md 30 · lg 40; `width` square/narrow (20px "more" chevron) · `tone` neutral/danger · `active` · `revealOnHover` (hover-capable pointers only; focus reveals) · **`aria-label` required** |
| `Input` | a text field | `size` sm 32/12.5 · md 40/15 · lg 44/15; `variant` well / bare (inside a composite that draws the chrome) / file; `leading` icon · `trailing` control (className then lands on the wrapper) · ref |
| `Textarea` | multi-line text | `size` sm/md · `resize` none/vertical |
| `SearchField` | a search box | `value`/`onValueChange`, `grow` (fill a toolbar row), `clearOnEscape` (off inside dialogs), clear button appears with content |
| `MenuSearch` | the filter row atop a menu or palette | `icon`, `size` md (palette) / sm (popover), `accentIcon`, `trailing` |
| `Label` | a form label | `requirement` required/optional (the word, never `*`), `aside` slot, `size` sm/md, `asChild` |
| `Field` | label + control + hint/error/count | `id` (pass the same id to the control), `label`, `requirement`, `aside`, `hint`, `error` (replaces hint, `role=alert`), `count {value,max}` |
| `FieldGroup` | one heading over a group of controls (choices, checkboxes) | `label` |
| `Checkbox` | a labelled checkbox | `label`, `note` (the consequence of ticking it) |
| `Segmented` | one-of-N: tabs, view switch, sort, mode | `variant` tray (raised choice in a recessed tray) / pills (accent-quiet choice, no tray); `size` md 13 · sm 12 · xs 11.5; `iconOnly` (36px squares; give each option `aria-label`); `fill`; options carry an icon element; `aria-pressed` per item |
| `Chip` | a label that describes (tag, handle, status, kind badge, eyebrow) | `tone` neutral/quiet/outline/accent/latex/success/danger/brand (`--brand` from an ancestor)/doc (`--doc-accent` from `docTypeVars`); `size` xs 9px badge · sm 24px · md hero label; `caps`, `mono` |
| `ChipButton` | a chip you press: a suggestion, a state toggle, an option | `tone`, `size` sm 24 / md 40, `selected` (accent quiet, `aria-pressed`), `shape` pill/rounded (an option among options), ref |
| `TextLink` | a link that reads as text (or a text-weight action) | `variant` quiet / underline / accent (the one link in a sentence, e.g. the auth footer); `size` 2xs/xs/inherit; `asChild` for a router `Link` or an external `<a>` |
| `BackLink` | "← Back to …" above a page header | wraps a router `Link` |
| `MenuPanel`, `MenuLabel`, `MenuItem`, `MenuEmpty` | a menu or any list inside a floating panel | panel: `origin` top-left/top-right/none, `inset` sm/md (placement stays with the caller). item: `size` sm/md, `icon`, `trailing`, `active` (keyboard cursor), `checked`, `asChild` |
| `Kbd` | a key | `variant` key (inline boxed) / cap (raised keycap) / fill (on a primary button) / bare (mono face inside another control) |

### Data display
| export | use this when… | variants |
|---|---|---|
| `Avatar` | a person, anywhere (seeded hue: one person, one colour) | `size` xs 24 · sm 30 · md 44 · lg 64 · xl 88; `shape` rounded/circle; `tone` seeded / accent (nav) / muted (photo picker), `alt` when meaningful; falls back to the initial if the image fails |
| `DocTypeIcon`, `docTypeVars()` | the MDX/LaTeX format mark | `type`, `size` sm 32 (14px glyph) / md 36 / lg 44 |
| `ListRow` | one item in a short list inside a panel or dialog (a person found, a person added) | `leading` (avatar/icon), `trailing` (its one action), `variant` plain (hover only) / filled (a chosen item), ref |

### Feedback & states
| export | use this when… | variants |
|---|---|---|
| `Spinner` | something is blocked until it finishes | `size` 2xs 10 · xs 12 · sm 14 · md 16 · lg 20 · xl 24 · 2xl 28 · 3xl 48; `tone` current/accent/brand/faint/ink; `label` |
| `LoadingState` | a screen or region waiting for its first load | `size` page (60dvh, large accent, optional `label`) / region (50dvh, quiet) / inline (inside an open sheet) |
| `Refreshing` | a re-fetch of content already on screen (never a spinner) | `active`, `label` |
| `Skeleton` | a placeholder in the shape of what is coming | `width`, `height` (the content's geometry), `radius` none/sm/md/lg/full |
| `Progress` | how much of something is done | `value` 0–1, `size` sm (2px, at rest) / md (3px, a run), `label` (makes it a `progressbar`) |
| `Notice` | what just happened, usually a failure and what to do | `tone` danger/warning/success/info, `variant` well/inline, `icon` |
| `ConfirmDialog` | "are you sure?" for a hard-to-undo action | `tone` primary/danger, `busy` (+`busyLabel`; not dismissable while busy) |
| `Divider` | a rule between groups | `orientation`, `space` sm/md |
| `EmptyState` | a list or section with nothing in it | `icon`, `title`, `description`, `action`, `tone` accent/muted, `variant` card / pane (a whole work surface: no chrome, ghosted) |
| `Toaster` | the one toast surface (mounted in `__root`) | sonner props |

### Overlays
| export | use this when… | variants |
|---|---|---|
| `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` | a modal (Radix: focus trap, Escape, return focus) | `DialogContent material` glass (over the page) / solid (opened from frosted chrome), `size` sm/md/lg. On `--z-modal`. Hand-rolled overlays still exist: LEDGER A-10 |

### Domain components that behave like primitives (outside `components/ui`)
- `BrandMark`, `ThemeToggle` (an `IconButton`), `VisibilityChip` (a `Chip`/`ChipButton`), `Collaborators` (a `ChipButton` + popover)
- `ProviderTile` (`components/ProviderTile.tsx`): a connected AI provider, with an `actions` slot. Used by the profile and the providers screen
- `MarkdownPreview` / `LatexPreview`, `CodeSurface`

## Coverage map

`OK` = covered · `PARTIAL` = a primitive exists but look-alikes or gaps remain · `MISSING` = no primitive (each is an audit finding).

| category | element | covered by | status |
|---|---|---|---|
| layout | page | `Page` | OK |
| layout | section | `PageHeader level=section`; `.band` | PARTIAL |
| layout | stack / row / grid / split / bar | `Stack`, `Row`, `Grid` / — / `PanelHeader` | OK / MISSING / PARTIAL |
| type | heading | `Heading`, `PageHeader`, `SectionHead`, `CardTitle` | OK |
| type | label | `Label`, `Field` | OK |
| type | meta line / numeral / prose block | `Text` / `Text numeric` / `.md-body` | OK / OK / PARTIAL |
| control | button / icon button | `Button`, `IconButton` | OK |
| control | link | `TextLink`, `BackLink` | OK |
| control | field / search | `Input`, `Textarea`, `Field`, `SearchField`, `MenuSearch` | OK |
| control | select | — (none rendered) | n/a |
| control | toggle | `Checkbox`; `ChipButton selected` | OK |
| control | tabs / segmented | `Segmented` | OK |
| control | chip | `Chip`, `ChipButton` | OK |
| control | menu | `MenuPanel` + `MenuItem` | OK |
| data | table | — (markdown only) | n/a |
| data | list row / definition list / stat / time | `ListRow` / `DetailRow` / — / `Text as="time"` | PARTIAL / OK / MISSING / OK |
| data | tag / avatar | `Chip` / `Avatar` | OK |
| feedback | empty | `EmptyState` | OK |
| feedback | loading | `Spinner`, `LoadingState`, `Refreshing` | OK |
| feedback | skeleton | `Skeleton` | OK |
| feedback | progress | `Progress` | OK |
| feedback | error / confirm | `Notice` / `ConfirmDialog` | OK |
| feedback | toast | `Toaster` | OK |
| overlay | dialog | Radix `Dialog` | PARTIAL (hand-rolled overlays, A-10) |
| overlay | popover / menu / drawer | — / `MenuPanel` / — | MISSING / OK / MISSING |
| media | image / code / markdown | — / — / `MarkdownPreview` | MISSING / MISSING / PARTIAL |

## Coverage metric

`.claude/skills/uiux/harness/coverage.py` (see `audit.md`).

| | baseline (25562bd) | after 2a | after 2b | after 3b | after 4.2 | end (51ee359) |
|---|---|---|---|---|---|---|
| all areas | 13.5% | 29.0% | 37.8% | ≈50% | 53.3% | 58.2% |
