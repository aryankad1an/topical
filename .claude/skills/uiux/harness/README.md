# uiux regression harness (project-specific)

Pixel + computed-style regression for `verify.md`, against a fixture-backed copy
of the app. Nothing here is imported by the app.

- `fixtures.py` — the API answers (edit when the API shape changes).
- `capture.py` — 28 route states × widths × themes → PNG + style fingerprint.
- `baseline.sh` — two runs of the reference server (`HARNESS_BASE`, default :5174,
  a worktree of the last commit served by the `uiux-baseline` launch entry).
- `check.sh NAME` — capture the working tree (:5173), diff, re-capture what
  differed once, report what still differs.
- `crop.py`, `probe.py` — inspect a diff; run JS over every state.
- `cssdiff.py` — the compiled-CSS gate. `cssrm.py` — exact-selector CSS removal.
- `coverage.py` — the primitive-coverage metric.

Output goes to `$HARNESS_OUT` (default `$TMPDIR/uiux-harness-out`; regenerate, never commit).
Paths resolve from this directory: the repo root is four levels up, Python is `$ROOT/.venv/bin/python`
(override with `HARNESS_PY`).

Setting up the reference server (removed at the end of every audit):

```bash
git worktree add --detach .claude/uiux-baseline-wt HEAD
ln -s ../../../frontend/node_modules .claude/uiux-baseline-wt/frontend/node_modules
```

Then add a launch entry named `uiux-baseline`: `npm run dev -- --port 5174 --strictPort`, with
`cwd: .claude/uiux-baseline-wt/frontend`. Advance it after each commit with
`git -C .claude/uiux-baseline-wt checkout --detach <sha>` and rerun `baseline.sh`. To tear it down,
remove the launch entry and run `git worktree remove --force .claude/uiux-baseline-wt`.
Requires the repo `.venv` with Playwright (crawl4ai installs it), PIL, numpy.
