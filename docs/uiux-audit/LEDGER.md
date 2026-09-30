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
