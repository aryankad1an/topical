# Defect catalogue

Placeholders (`<SRC>`, `<STYLES>`, `<TOKENS>`, `<PRIMITIVES_DIR>`, `<PAGES>`, `<FEATURES>`, `<THEME_ATTR>`) resolve in `project.md`. Run greps with **bash**, not zsh: zsh expands `--include=*.tsx` as a glob and fails.

Every detector is a **candidate finder**. Read each hit before logging it, and check it against the exceptions.

Severity: **P0** broken/inaccessible · **P1** UX bar unmet, or a look-alike of an existing primitive · **P2** consistency (tokens, missing category, duplication) · **P3** polish/simplification.

## Measuring primitive coverage (ledger header metric)

For each area's TSX: `coverage = P / (P + R)`.
- **P** = JSX instances of anything exported from `<PRIMITIVES_DIR>`.
- **R** = lowercase host elements carrying `className=` or `style=`.
- Unstyled host elements count in neither.

```bash
# R: styled raw host elements in a file set
grep -oE '<[a-z][a-z0-9]*\b[^>]*\b(className|style)=' FILES | wc -l
```

Use the same script before and after, and say it's a proxy: multi-line tags can undercount R.

---

## A. Primitive detectors (run first)

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| A1 | **Styled raw element** in a page/feature | `grep -nE '<(div\|span\|button\|input\|textarea\|a\|p\|h[1-6]\|ul\|li\|img\|section)\b[^>]*(className\|style)=' <PAGES> <FEATURES>` | Pure structure: a class that only positions (grid-area, `min-w-0`, `sr-only`) with no colour/type/border/spacing identity. Anything inside `<PRIMITIVES_DIR>` | P2 (P1 if it imitates an existing primitive) |
| A2 | **Repeated markup+class pattern** | Take the class strings from A1 hits and count duplicates: `grep -ohE 'className="[^"]+"' <PAGES> <FEATURES> \| sort \| uniq -c \| sort -rn \| awk '$1>=2'` | Single-utility strings (`"flex-1"`) | P2 |
| A3 | **Appearance-only feature class**: a class defined in `<STYLES>` and used by one feature, setting only colour/border/radius/shadow/type | List the selectors in feature-owned stylesheets, then `grep -rn '<class>'` each one; a single-feature user plus appearance-only declarations = hit | Layout-only rules (grid templates, positioning) for a feature's unique geometry | P2 |
| A4 | **Look-alike of an existing primitive** | For each primitive's signature class/tokens (see `primitives.md`), grep for the *same declarations* on other selectors or elements: e.g. raw `<button className="…btn…">` beside a `Button` primitive, a second avatar, a hand-rolled fixed overlay beside `Dialog`, a spinner beside a loading primitive | None | **P1** |
| A5 | **Overlapping primitives**: two exports covering one shape | Compare `primitives.md` rows per category; any category with 2+ exports, or a primitive plus CSS aliases for the same look | A deliberate split with a different accessibility contract (a dialog vs a non-modal popover) | P2 (P1 if call sites disagree visibly) |
| A6 | **Primitive bypassed via inline style/className override** | `grep -nE '<[A-Z]\w*[^>]*style=\{\{' <PAGES> <FEATURES>`, plus `className=` overrides that restate colour/border/radius on a primitive | Computed, genuinely dynamic values (a measured width, a CSS custom property carrying a seeded hue) | P2 |
| A7 | **MISSING coverage category** | Each `MISSING` row in `primitives.md` is one finding, plus one finding per hand-roll site | None | P2 |
| A8 | **Primitive under the quality bar** | Read each primitive: no ref forwarding, 4+ booleans, inline styles/raw values, no disabled/loading/error state where it applies, off the control height, no docs line | — | P2 (P1 if it breaks focus or a11y) |

## B. Tokens & CSS

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| B1 | Raw colour | `grep -nE '#[0-9a-fA-F]{3,8}\b\|rgba?\([0-9]\|hsla?\([0-9]' <STYLES> <SRC>/**/*.tsx` minus `<TOKENS>` | The token file itself; SVG filter math; third-party theme imports | P2 |
| B2 | Raw spacing/size px in components | `grep -nE '\b[a-z-]+-\[[0-9.]+(px\|rem)\]' <PAGES> <FEATURES>`; `style=\{\{[^}]*[0-9]+(px)?` | Hairline `1px`; measured/dynamic values | P2 |
| B3 | Raw duration/easing | `grep -nE '[0-9]+m?s\b\|cubic-bezier' <STYLES>` minus `<TOKENS>`; plus JS `duration:` literals | A keyframe's internal percentages; the keyword curves `linear`/`steps()`/`ease-in-out` on **looping** progress animations (spinner, shimmer, caret); `0.01ms` in the reduced-motion block | P2 |
| B4 | Raw z-index | `grep -nE 'z-index:\s*-?[0-9]+' <STYLES>`; `z-\[?[0-9]+` in TSX | `-1`/`0`/`1` for local stacking inside one component | P2 |
| B5 | **Token missing from a theme** | Parse each theme block in `<TOKENS>` and diff the colour-valued keys (a python snippet over `--[\w-]+:`) | Theme-invariant tokens (type, radius, motion, sizes) | **P0** if it shows as wrong in a theme, else P2 |
| B6 | Token used but never defined | Diff `var(--x)` uses against `--x:` definitions across `<SRC>` | A `var(--a, fallback)` hook left for callers on purpose | P1 |
| B7 | Dead CSS | Selector not found in any source file | **Class names built at runtime** (template strings, `` `${base}--${size}` ``); check `project.md`'s standing rules for known dynamic families. Use the project's CSS-diff gate before deleting | P3 |
| B8 | className with no rule | Class string in TSX with no selector in `<STYLES>` and no Tailwind meaning | JS hooks (`group`, `peer`, `data-*` selectors) | P3 |
| B9 | Duplicated declaration blocks | Normalise rule bodies and group identical ones (python over `<STYLES>`) | Media-query restatements | P2 |
| B10 | Later-file "shared base" silently overriding earlier rules | For each selector declared in 2+ files, check the import order in the stylesheet entry | — | P1 |

## C. Interaction & accessibility

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| C1 | Clickable non-interactive element | `grep -nE '<(div\|span\|li\|tr\|td)\b[^>]*onClick' <PAGES> <FEATURES>` | **Overlay scrims** that close on click (need `aria-hidden` and an Escape path); `stopPropagation`-only wrappers | P0 |
| C2 | Suppressed focus with no replacement | `grep -n 'outline:\s*none\|outline-none' <STYLES> <SRC>`; check each for a `box-shadow`/border ring on `:focus`/`:focus-visible`, or a ring-carrying ancestor (`:focus-within`) | Elements that aren't focusable | P0 |
| C3 | Icon-only control without a name | `<button` or `IconButton` whose children are only an icon, with no `aria-label` or `title`+sr text | — | P0 |
| C4 | Missing labels/alt | `<input` without `id`+`<label htmlFor>` or `aria-label`; `<img` without `alt` | Decorative `alt=""` | P0 |
| C5 | Hover-only affordance | `grep -nE 'group-hover:opacity\|opacity-0[^"]*group-hover\|:hover[^{]*\{[^}]*(opacity:\s*1\|visibility)' ` and a `revealOnHover` prop | Revealed on `:focus-visible`/`:focus-within` **and** on touch (`@media (hover: none)`) | P1 |
| C6 | Control off the shared control height | Controls in one toolbar row whose measured `offsetHeight` differs; CSS `height:` on controls not using the control-height token | Deliberately small chips that declare their own token height | P2 |
| C7 | Overlay without Escape/focus return/scroll lock | Hand-rolled `fixed inset-0` overlays: `grep -n 'fixed inset-0\|position:\s*fixed'` | Non-modal toasts | P0 |
| C8 | Contrast below floor | Measured in the browser (`verify.md`) per theme | Disabled controls; decorative text | P0 |

## D. Layout & responsiveness

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| D1 | `vh` where `dvh` belongs | `grep -nE '[0-9]+vh\b\|h-screen\|min-h-screen' <STYLES> <SRC>` | `max-height: Nvh` on a scrollable popover, where dvh changes nothing | P2 (P1 on a full-height shell on mobile) |
| D2 | Horizontal page overflow | Measured (`verify.md`) at 360px | — | P0 |
| D3 | Layout shift | Measured (`verify.md` CLS observer); images without dimensions; async content with no reserved box | — | P1 |
| D4 | Global overflow masking | `overflow-x: hidden` on `html`/`body` | A documented dependency (see `project.md`); still log it, as an ask | P2 |
| D5 | Wide content without its own scroller | Tables/code/pre without an `overflow-x: auto` container | — | P1 |

## E. Architecture

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| E1 | Oversized component | Files over ~250 lines; components with 3+ `useState` and unrelated effects | Route shells that only compose | P3 |
| E2 | Fetch/storage/parsing inside a component | `grep -n 'fetch(\|localStorage\|sessionStorage\|JSON.parse' <PAGES> <FEATURES>` | Calls into the project's lib/hooks | P2 |
| E3 | Primitive with 4+ booleans | Read the prop types | — | P2 |
| E4 | `useEffect` that should be an event handler / derived state | Effects that set state from props or run on a click flag | — | P3 |

## F. UX compliance

| id | defect | detect | exceptions | sev |
|---|---|---|---|---|
| F1 | Missing empty/loading/error state | For each data-driven component, find the query/props and check all three branches render | — | P1 |
| F2 | Shareable state not in the URL | `useState` holding tab/sort/filter/search/view/page on a list page | Ephemeral UI (hover, open menus) | P1 (fix is **ask**: behaviour change) |
| F3 | Lost input | Forms that reset on error; drafts in uncontrolled state lost on navigation or close | — | P1 |
| F4 | Destructive action neither confirmed nor undoable | Delete handlers called straight from onClick | — | P0 |
| F5 | Motion ignoring reduced motion | JS animations (`element.animate`, rAF loops) without a `prefers-reduced-motion` check; CSS animations outside the global reduce block's reach (`!important` inline) | — | P1 |
| F6 | Off-voice copy | `grep -nE '!\s*["<]\|Oops\|Submit\b\|Click here' <PAGES> <FEATURES>` | Code/keyboard hints | P3 |
| F7 | More than one primary / loudest element per view | Browser pass: count primary-tier controls per route state | Separate views (a dialog over a page) | P1 |
| F8 | No route error / not-found UI | Router config lacks error and not-found components | — | P1 |
