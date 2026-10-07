#!/bin/bash
# usage: check.sh NAME [filter]
# Capture the working tree's dev server, diff against base/+baseB/, recapture
# whatever differed once (flake filter), and report what still differs.
H="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$H/../../../.." && pwd)"
OUT="${HARNESS_OUT:-${TMPDIR:-/tmp}/uiux-harness-out}"
PY="${HARNESS_PY:-$ROOT/.venv/bin/python}"
export HARNESS_BASE="${HARNESS_BASE:-http://localhost:5173}"
mkdir -p "$OUT"; cd "$OUT"
rm -rf "$1" "$1-r"
(cd "$H" && $PY capture.py "$OUT/$1" $2) | grep -v "False 0$"
$PY "$H/diff.py" "$1" $2 > "$1/_diff1.txt"
if [ -s "$1/_bad.txt" ]; then
  (cd "$H" && $PY capture.py "$OUT/$1-r" --tags "$OUT/$1/_bad.txt") >/dev/null 2>&1
  $PY "$H/diff.py" "$1-r"
else
  echo "-- 0 differing captures"
fi
