#!/bin/bash
# Capture two baseline runs (base/, baseB/) from the reference server.
H="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$H/../../../.." && pwd)"
OUT="${HARNESS_OUT:-${TMPDIR:-/tmp}/uiux-harness-out}"
PY="${HARNESS_PY:-$ROOT/.venv/bin/python}"
export HARNESS_BASE="${HARNESS_BASE:-http://localhost:5174}"
mkdir -p "$OUT"; rm -rf "$OUT/base" "$OUT/baseB"
(cd "$H" && $PY capture.py "$OUT/base" >/dev/null && $PY capture.py "$OUT/baseB" >/dev/null)
cd "$OUT" && $PY "$H/diff.py" baseB | tail -1
